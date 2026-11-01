'use client'

import { useId } from 'react'
import { cn } from '@/lib/utils'

// Chef Chi: a friendly home-cook illustration. She blinks, her hat sways, she
// bobs gently and the sparkles twinkle. `talking` moves her mouth, used while
// she is writing a reply.
const CSS = `
.chi-on .chi-bob{animation:chi-bob 3.2s ease-in-out infinite}
.chi-on .chi-hat{animation:chi-hat 4.6s ease-in-out infinite;transform-origin:60px 45px}
.chi-on .chi-eye{animation:chi-blink 4.2s infinite;transform-box:fill-box;transform-origin:center}
.chi-on .chi-star{animation:chi-twinkle 2.6s ease-in-out infinite;transform-box:fill-box;transform-origin:center}
.chi-on .chi-star-b{animation-delay:1.1s}
.chi-on.chi-talk .chi-mouth{animation:chi-talk .3s ease-in-out infinite alternate;transform-origin:60px 74px}
@keyframes chi-bob{0%,100%{transform:translateY(0)}50%{transform:translateY(-1.8px)}}
@keyframes chi-hat{0%,100%{transform:rotate(0)}30%{transform:rotate(-2.4deg)}70%{transform:rotate(2deg)}}
@keyframes chi-blink{0%,91%,100%{transform:scaleY(1)}94.5%{transform:scaleY(.08)}}
@keyframes chi-twinkle{0%,100%{opacity:.25;transform:scale(.55)}50%{opacity:1;transform:scale(1.1)}}
@keyframes chi-talk{from{transform:scaleY(1)}to{transform:scaleY(.45)}}
@media (prefers-reduced-motion:reduce){.chi-on *{animation:none!important}}
`

export function ChefChiAvatar({
  size = 56,
  talking = false,
  animated = true,
  className,
}: {
  size?: number
  talking?: boolean
  animated?: boolean
  className?: string
}) {
  const uid = useId().replace(/:/g, '')

  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 120 120"
      role="img"
      aria-label="Chef Chi"
      className={cn(
        'shrink-0 rounded-full',
        animated && 'chi-on',
        talking && 'chi-talk',
        className,
      )}
    >
      <style>{CSS}</style>
      <defs>
        <linearGradient id={`${uid}bg`} x1="0" y1="0" x2="1" y2="1">
          <stop offset="0" stopColor="#FFC98F" />
          <stop offset="1" stopColor="#F2622C" />
        </linearGradient>
        <linearGradient id={`${uid}skin`} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" stopColor="#A0663F" />
          <stop offset="1" stopColor="#85502F" />
        </linearGradient>
        <clipPath id={`${uid}clip`}>
          <circle cx="60" cy="60" r="60" />
        </clipPath>
      </defs>

      <g clipPath={`url(#${uid}clip)`}>
        <rect width="120" height="120" fill={`url(#${uid}bg)`} />
        <circle cx="30" cy="22" r="34" fill="#fff" opacity="0.14" />

        <g className="chi-bob">
          {/* neck and coat */}
          <path d="M52 78 L52 94 Q60 100 68 94 L68 78 Z" fill="#7C4A2B" />
          <path
            d="M6 126 C8 101 34 92 60 92 C86 92 112 101 114 126 Z"
            fill="#FFFFFF"
          />
          <path d="M60 100 L60 126" stroke="#EADFD0" strokeWidth="1.2" />
          <circle cx="54" cy="108" r="1.9" fill="#E3D3BE" />
          <circle cx="54" cy="118" r="1.9" fill="#E3D3BE" />
          <circle cx="66" cy="108" r="1.9" fill="#E3D3BE" />
          <circle cx="66" cy="118" r="1.9" fill="#E3D3BE" />
          <path d="M47 92 L60 106 L73 92 Q60 97 47 92Z" fill="#E85A2A" />

          {/* hair behind the head */}
          <ellipse cx="60" cy="56" rx="27" ry="28" fill="#1F120D" />
          <circle cx="35" cy="64" r="8" fill="#1F120D" />
          <circle cx="85" cy="64" r="8" fill="#1F120D" />

          {/* face */}
          <circle cx="38.6" cy="63" r="3.6" fill="#85502F" />
          <circle cx="81.4" cy="63" r="3.6" fill="#85502F" />
          <circle cx="38.6" cy="69.5" r="2" fill="#F6C453" />
          <circle cx="81.4" cy="69.5" r="2" fill="#F6C453" />
          <ellipse
            cx="60"
            cy="60"
            rx="21.5"
            ry="24"
            fill={`url(#${uid}skin)`}
          />

          {/* fringe */}
          <path
            d="M37.5 54 Q39 35 60 34 Q81 35 82.5 54 Q71 42.5 60 43.5 Q49 42.5 37.5 54Z"
            fill="#1F120D"
          />

          {/* chef hat */}
          <g className="chi-hat">
            <circle cx="47" cy="31" r="9.5" fill="#fff" stroke="#E7DCCD" />
            <circle cx="73" cy="31" r="9.5" fill="#fff" stroke="#E7DCCD" />
            <circle cx="60" cy="24.5" r="12.5" fill="#fff" stroke="#E7DCCD" />
            <rect
              x="38.5"
              y="34"
              width="43"
              height="11"
              rx="3.5"
              fill="#fff"
              stroke="#E7DCCD"
            />
            <path
              d="M48 36 V43 M60 36 V43 M72 36 V43"
              stroke="#EFE5D8"
              strokeWidth="1.2"
              strokeLinecap="round"
            />
          </g>

          {/* eyes */}
          <g className="chi-eye">
            <ellipse cx="51" cy="62" rx="2.8" ry="3.5" fill="#1B100B" />
            <circle cx="52" cy="60.7" r="1" fill="#fff" />
          </g>
          <g className="chi-eye">
            <ellipse cx="69" cy="62" rx="2.8" ry="3.5" fill="#1B100B" />
            <circle cx="70" cy="60.7" r="1" fill="#fff" />
          </g>
          <path
            d="M47.4 60 Q46.3 59 45.7 57.8 M72.6 60 Q73.7 59 74.3 57.8"
            stroke="#1B100B"
            strokeWidth="1.3"
            strokeLinecap="round"
            fill="none"
          />
          <path
            d="M45.5 55.6 Q51 52.4 56 55 M64 55 Q69 52.4 74.5 55.6"
            stroke="#1F120D"
            strokeWidth="1.9"
            strokeLinecap="round"
            fill="none"
          />

          {/* nose, cheeks, smile */}
          <path
            d="M60 65 Q58.4 69 60.8 69.8"
            stroke="#5E341F"
            strokeWidth="1.4"
            strokeLinecap="round"
            fill="none"
            opacity="0.7"
          />
          <ellipse
            cx="44.5"
            cy="70"
            rx="4.2"
            ry="2.6"
            fill="#EE7B5C"
            opacity="0.4"
          />
          <ellipse
            cx="75.5"
            cy="70"
            rx="4.2"
            ry="2.6"
            fill="#EE7B5C"
            opacity="0.4"
          />
          <g className="chi-mouth">
            <path
              d="M51.5 73 Q60 74.6 68.5 73 Q65 82.5 60 82.5 Q55 82.5 51.5 73Z"
              fill="#8E2A31"
            />
            <path
              d="M53 73.5 Q60 75 67 73.5 Q64.5 77 60 77 Q55.5 77 53 73.5Z"
              fill="#fff"
            />
          </g>
        </g>

        {/* sparkles */}
        <path
          className="chi-star"
          d="M98 20 L100 26 L106 28 L100 30 L98 36 L96 30 L90 28 L96 26 Z"
          fill="#FFF3B8"
        />
        <path
          className="chi-star chi-star-b"
          d="M18 44 L19.5 48.5 L24 50 L19.5 51.5 L18 56 L16.5 51.5 L12 50 L16.5 48.5 Z"
          fill="#FFF3B8"
        />
      </g>
    </svg>
  )
}
