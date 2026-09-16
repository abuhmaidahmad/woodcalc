import logging

import anthropic
from django.conf import settings
from rest_framework import status
from rest_framework.permissions import IsAuthenticated
from rest_framework.response import Response
from rest_framework.views import APIView
from tenants.permissions import HasActiveCompany

logger = logging.getLogger(__name__)

MODEL = 'claude-opus-5'

VALID_CATEGORIES = ['base', 'wall', 'tall', 'vanity', 'corner', 'specialty', 'accessories']

SYSTEM_PROMPT = """You are the Designer Agent inside WoodCalc, a Kitchen Planner tool used by \
professional cabinet designers. A designer is describing a cabinet that doesn't exist in their \
standard parts catalog — your job is to turn their plain-language description into a complete, \
buildable cabinet definition.

Cabinets in this app are parametric boxes (width × height × depth), not fixed 3D models, so you \
never need to invent new geometry — just sensible dimensions and a category/subtype.

There are exactly six valid `category` values:
- base: a floor-standing cabinet that sits under a countertop.
- wall: an upper cabinet mounted on the wall above a worktop.
- tall: a full-height housing for a pantry, oven, or fridge (~2220mm tall).
- vanity: a bathroom cabinet, usually housing a sink.
- corner: an L-shape, blind-corner, or diagonal corner unit.
- specialty: anything freestanding or custom that doesn't fit the above — a TV unit, bar unit, \
coffee station, linen tower, etc.
- (accessories also exists for fillers/panels/shelves/toe-kicks, but you should rarely need it — \
prefer one of the six above for anything the designer is actually asking you to design.)

Typical dimension ranges for context (mm):
- Base cabinets: height usually 720 or 800mm, depth 560-600mm.
- Wall cabinets: depth ~300mm, mounted so the bottom sits about 1470-1480mm above the floor.
- Tall units: height ~2220mm, depth 560-600mm.
- Vanities: height matches base height, depth ~500-550mm.

When a critical dimension is genuinely missing or ambiguous (e.g. the designer gave no width at \
all, or the category is unclear), ask ONE short, plain-text clarifying question — do not call the \
tool in that turn. Otherwise, lean toward proposing something reasonable with sane defaults rather \
than interrogating the designer over every field — a professional designer would rather see a \
concrete proposal to tweak than answer a questionnaire. Once you have enough information, call the \
propose_cabinet tool with a complete, sensible design."""

PROPOSE_CABINET_TOOL = {
    "name": "propose_cabinet",
    "description": "Propose a complete cabinet definition once you have enough information from the conversation.",
    "strict": True,
    "input_schema": {
        "type": "object",
        "properties": {
            "name": {"type": "string", "description": "Short catalog label, e.g. 'Corner TV Unit 900'"},
            "category": {"type": "string", "enum": VALID_CATEGORIES},
            "subtype": {"type": "string", "description": "Short descriptive subtype, e.g. 'Custom', 'Open Shelf'. Default to 'Custom' unless it clearly matches a standard cabinetry term."},
            "width": {"type": "integer", "minimum": 100, "maximum": 3000},
            "height": {"type": "integer", "minimum": 100, "maximum": 2500},
            "depth": {"type": "integer", "minimum": 100, "maximum": 800},
            "door_count": {"type": "integer", "minimum": 0, "maximum": 4},
            "shelves": {"type": "integer", "minimum": 0, "maximum": 10},
            "drawer_system": {"type": "string"},
            "wall_height": {"type": "integer", "minimum": 100, "maximum": 2500, "description": "Only meaningful when category is 'wall' — same as height."},
            "elevation": {"type": "integer", "minimum": 0, "maximum": 2500, "description": "Only meaningful when category is 'wall' — height off the floor to the cabinet's bottom."},
            "explanation": {"type": "string", "description": "One or two sentences explaining the design to show the user."},
        },
        "required": ["name", "category", "subtype", "width", "height", "depth", "explanation"],
        "additionalProperties": False,
    },
}


class DesignerAgentChatView(APIView):
    """Stateless chat turn for the Kitchen Planner's AI Designer Agent. The frontend
    keeps the running conversation client-side and resends the full history each
    turn. This endpoint never writes to the database — saving a proposed cabinet as
    a reusable CabinetTemplate is a separate, explicit POST /cabinet-templates/ call
    the frontend makes only when the designer accepts it."""
    permission_classes = [IsAuthenticated, HasActiveCompany]

    def post(self, request):
        if not settings.ANTHROPIC_API_KEY:
            return Response({'error': 'AI Designer is not configured.'}, status=status.HTTP_503_SERVICE_UNAVAILABLE)

        raw_messages = request.data.get('messages', [])
        if not isinstance(raw_messages, list) or not raw_messages:
            return Response({'error': 'messages is required and must be a non-empty list.'}, status=status.HTTP_400_BAD_REQUEST)

        payload_messages = []
        for m in raw_messages:
            role = m.get('role') if isinstance(m, dict) else None
            content = m.get('content') if isinstance(m, dict) else None
            if role not in ('user', 'assistant') or not isinstance(content, str):
                return Response({'error': 'Each message needs a role of "user" or "assistant" and string content.'}, status=status.HTTP_400_BAD_REQUEST)
            payload_messages.append({'role': role, 'content': content})

        client = anthropic.Anthropic(api_key=settings.ANTHROPIC_API_KEY)

        try:
            response = client.messages.create(
                model=MODEL,
                max_tokens=4096,
                system=SYSTEM_PROMPT,
                tools=[PROPOSE_CABINET_TOOL],
                messages=payload_messages,
            )
        except anthropic.AuthenticationError as e:
            logger.error('Designer Agent: Anthropic auth error: %s', getattr(e, 'message', e))
            return Response({'error': 'AI Designer is not configured correctly.'}, status=status.HTTP_503_SERVICE_UNAVAILABLE)
        except anthropic.RateLimitError as e:
            logger.warning('Designer Agent: Anthropic rate limited: %s', getattr(e, 'message', e))
            return Response({'error': 'The AI Designer is busy right now. Please try again in a moment.'}, status=status.HTTP_429_TOO_MANY_REQUESTS)
        except anthropic.APIConnectionError as e:
            logger.error('Designer Agent: could not reach Anthropic: %s', e)
            return Response({'error': 'Could not reach the AI Designer service. Please try again.'}, status=status.HTTP_502_BAD_GATEWAY)
        except anthropic.APIStatusError as e:
            logger.error('Designer Agent: Anthropic API error %s: %s | body=%s', e.status_code, getattr(e, 'message', e), getattr(e, 'body', None))
            if e.status_code >= 500:
                return Response({'error': 'The AI Designer service is temporarily unavailable. Please try again.'}, status=status.HTTP_502_BAD_GATEWAY)
            return Response({'error': 'The AI Designer could not process that request.'}, status=status.HTTP_400_BAD_REQUEST)

        proposal = None
        text_parts = []
        for block in response.content:
            if block.type == 'text' and block.text:
                text_parts.append(block.text)
            elif block.type == 'tool_use' and block.name == 'propose_cabinet':
                data = dict(block.input)
                # Defensive second layer beyond the strict schema: clamp category to
                # the known set server-side too — cheap insurance, not the primary
                # validation mechanism (strict:true already guarantees this in practice).
                if data.get('category') not in VALID_CATEGORIES:
                    data['category'] = 'specialty'
                proposal = data

        if proposal is not None:
            reply = proposal.get('explanation') or '\n'.join(text_parts) or 'Here is a proposed cabinet.'
        else:
            reply = '\n'.join(text_parts).strip() or "I didn't quite catch that — could you tell me more about the cabinet you need?"

        return Response({'reply': reply, 'proposal': proposal})
