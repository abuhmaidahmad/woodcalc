import React from 'react'
import markBlack from '../assets/woodcalc-mark-black.png'
import markWhite from '../assets/woodcalc-mark-white.png'

export default function Logo({ forDarkBg = false, height = 22, onClick, style }) {
  return (
    <img
      src={forDarkBg ? markWhite : markBlack}
      alt="WoodCalc"
      onClick={onClick}
      style={{ height, width: 'auto', display: 'block', cursor: onClick ? 'pointer' : 'default', ...style }}
    />
  )
}
