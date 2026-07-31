"use client";

export function SwipeBackground() {
    return (
        <div className="fixed inset-0 -z-10 overflow-hidden bg-[var(--bg)]">
            {/* Animated gradient orbs */}
            <div className="absolute top-[-10%] left-[-10%] w-[500px] h-[500px] rounded-full bg-[var(--primary)]/5 blur-[100px] animate-drift-slow" />
            <div className="absolute bottom-[-10%] right-[-10%] w-[400px] h-[400px] rounded-full bg-amber-500/5 blur-[80px] animate-drift-slow-reverse" />
            <div className="absolute top-[40%] left-[60%] w-[300px] h-[300px] rounded-full bg-[var(--success)]/5 blur-[60px] animate-pulse-soft" />

            {/* Subtle dot pattern overlay */}
            <div
                className="absolute inset-0 opacity-[0.03]"
                style={{
                    backgroundImage: `radial-gradient(circle, var(--text) 1px, transparent 1px)`,
                    backgroundSize: '24px 24px'
                }}
            />

            {/* Floating food emojis - very subtle */}
            <div className="absolute inset-0 pointer-events-none overflow-hidden">
                {['🍲', '🍛', '🥘', '🍗', '🍤', '🌶️', '🥥', '🍌'].map((emoji, i) => (
                    <span
                        key={i}
                        className="absolute text-2xl opacity-[0.04] select-none animate-float-gentle"
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
    );
}