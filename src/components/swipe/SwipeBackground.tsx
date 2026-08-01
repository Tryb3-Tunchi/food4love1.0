'use client'

export function SwipeBackground() {
  return (
    <div className="fixed inset-0 -z-10 overflow-hidden bg-[var(--bg)]">
      {/* Animated gradient orbs */}
      <div className="bg-[var(--primary)]/5 absolute left-[-10%] top-[-10%] h-[500px] w-[500px] animate-drift-slow rounded-full blur-[100px]" />
      <div className="absolute bottom-[-10%] right-[-10%] h-[400px] w-[400px] animate-drift-slow-reverse rounded-full bg-amber-500/5 blur-[80px]" />
      <div className="bg-[var(--success)]/5 absolute left-[60%] top-[40%] h-[300px] w-[300px] animate-pulse-soft rounded-full blur-[60px]" />

      {/* Subtle dot pattern overlay */}
      <div
        className="absolute inset-0 opacity-[0.03]"
        style={{
          backgroundImage: `radial-gradient(circle, var(--text) 1px, transparent 1px)`,
          backgroundSize: '24px 24px',
        }}
      />

      {/* Floating food emojis - very subtle */}
      <div className="pointer-events-none absolute inset-0 overflow-hidden">
        {['🍲', '🍛', '🥘', '🍗', '🍤', '🌶️', '🥥', '🍌'].map((emoji, i) => (
          <span
            key={i}
            className="absolute animate-float-gentle select-none text-2xl opacity-[0.04]"
            style={{
              left: `${10 + i * 12}%`,
              top: `${15 + (i % 3) * 25}%`,
              animationDelay: `${i * 0.7}s`,
              animationDuration: `${8 + i * 2}s`,
            }}
          >
            {emoji}
          </span>
        ))}
      </div>
    </div>
  )
}
