import { useEffect, useRef, type CSSProperties } from "react";
import "./atmosphere.css";

type Particle = {
  left: number;
  top: number;
  size: number;
  opacity: number;
  delay: number;
  duration: number;
  driftX: number;
  driftY: number;
};

type ActivityNode = {
  id: string;
  x: number;
  y: number;
  size: number;
  opacity: number;
  pulseDelay: number;
  pulseDuration: number;
};

type ActivityArc = {
  id: string;
  path: string;
  delay: number;
  duration: number;
};

// Keep particles deterministic so the background stays stable across renders.
const PARTICLES: Particle[] = [
  { left: 8, top: 18, size: 4, opacity: 0.48, delay: -4, duration: 28, driftX: 10, driftY: -12 },
  { left: 14, top: 34, size: 3, opacity: 0.34, delay: -12, duration: 34, driftX: 8, driftY: -10 },
  { left: 19, top: 62, size: 5, opacity: 0.4, delay: -18, duration: 30, driftX: 12, driftY: 8 },
  { left: 25, top: 22, size: 2, opacity: 0.3, delay: -8, duration: 26, driftX: -8, driftY: 10 },
  { left: 31, top: 48, size: 4, opacity: 0.42, delay: -20, duration: 32, driftX: 14, driftY: -8 },
  { left: 36, top: 14, size: 3, opacity: 0.36, delay: -2, duration: 24, driftX: 10, driftY: 6 },
  { left: 42, top: 70, size: 4, opacity: 0.32, delay: -16, duration: 36, driftX: -12, driftY: -10 },
  { left: 48, top: 38, size: 2, opacity: 0.28, delay: -10, duration: 27, driftX: 6, driftY: 9 },
  { left: 53, top: 20, size: 5, opacity: 0.38, delay: -6, duration: 40, driftX: 16, driftY: -12 },
  { left: 58, top: 57, size: 3, opacity: 0.33, delay: -14, duration: 29, driftX: -10, driftY: 10 },
  { left: 64, top: 30, size: 4, opacity: 0.45, delay: -24, duration: 33, driftX: 11, driftY: -6 },
  { left: 69, top: 78, size: 3, opacity: 0.25, delay: -9, duration: 35, driftX: -7, driftY: -10 },
  { left: 73, top: 45, size: 6, opacity: 0.38, delay: -13, duration: 31, driftX: 9, driftY: 12 },
  { left: 78, top: 16, size: 2, opacity: 0.3, delay: -5, duration: 25, driftX: 7, driftY: -7 },
  { left: 82, top: 60, size: 4, opacity: 0.35, delay: -19, duration: 38, driftX: -10, driftY: 10 },
  { left: 87, top: 27, size: 3, opacity: 0.4, delay: -11, duration: 28, driftX: 12, driftY: -8 },
  { left: 90, top: 51, size: 5, opacity: 0.42, delay: -22, duration: 34, driftX: -9, driftY: 10 },
  { left: 93, top: 72, size: 3, opacity: 0.27, delay: -15, duration: 30, driftX: 8, driftY: -12 },
];

/* Activity nodes are positioned in the horizon SVG's 1000x1000 space.
   To shift activity toward different regions, adjust the x/y coordinates.
   Pulse timing is controlled per node with pulseDelay/pulseDuration below. */
const ACTIVITY_NODES: ActivityNode[] = [
  { id: "na-west", x: 250, y: 280, size: 6, opacity: 0.3, pulseDelay: -8, pulseDuration: 9.5 },
  { id: "na-east", x: 330, y: 265, size: 5, opacity: 0.32, pulseDelay: -2, pulseDuration: 10.5 },
  { id: "central-america", x: 345, y: 360, size: 4, opacity: 0.26, pulseDelay: -10, pulseDuration: 8.5 },
  { id: "andes", x: 365, y: 460, size: 5, opacity: 0.28, pulseDelay: -4, pulseDuration: 11 },
  { id: "south-cone", x: 390, y: 610, size: 4, opacity: 0.24, pulseDelay: -15, pulseDuration: 9 },
  { id: "uk", x: 470, y: 245, size: 4, opacity: 0.28, pulseDelay: -6, pulseDuration: 8.5 },
  { id: "western-europe", x: 500, y: 275, size: 5, opacity: 0.33, pulseDelay: -12, pulseDuration: 10 },
  { id: "scandinavia", x: 540, y: 210, size: 4, opacity: 0.22, pulseDelay: -1, pulseDuration: 12 },
  { id: "north-africa", x: 520, y: 355, size: 4, opacity: 0.27, pulseDelay: -9, pulseDuration: 9.5 },
  { id: "west-africa", x: 500, y: 425, size: 5, opacity: 0.3, pulseDelay: -5, pulseDuration: 10.5 },
  { id: "east-africa", x: 585, y: 430, size: 4, opacity: 0.29, pulseDelay: -13, pulseDuration: 8.5 },
  { id: "southern-africa", x: 575, y: 585, size: 5, opacity: 0.24, pulseDelay: -7, pulseDuration: 11.5 },
  { id: "middle-east", x: 610, y: 330, size: 4, opacity: 0.27, pulseDelay: -3, pulseDuration: 9 },
  { id: "central-asia", x: 660, y: 255, size: 4, opacity: 0.23, pulseDelay: -14, pulseDuration: 12 },
  { id: "india", x: 690, y: 395, size: 5, opacity: 0.31, pulseDelay: -11, pulseDuration: 10 },
  { id: "southeast-asia", x: 760, y: 430, size: 5, opacity: 0.29, pulseDelay: -4, pulseDuration: 9.5 },
  { id: "east-asia", x: 800, y: 310, size: 5, opacity: 0.32, pulseDelay: -16, pulseDuration: 11 },
  { id: "japan", x: 860, y: 320, size: 4, opacity: 0.25, pulseDelay: -6, pulseDuration: 8 },
  { id: "indonesia", x: 785, y: 520, size: 4, opacity: 0.26, pulseDelay: -2, pulseDuration: 10.5 },
  { id: "australia-west", x: 815, y: 620, size: 4, opacity: 0.24, pulseDelay: -9, pulseDuration: 9 },
  { id: "australia-east", x: 880, y: 650, size: 5, opacity: 0.27, pulseDelay: -12, pulseDuration: 11.5 },
  { id: "pacific", x: 710, y: 170, size: 3, opacity: 0.18, pulseDelay: -5, pulseDuration: 13 },
  { id: "atlantic", x: 430, y: 330, size: 3, opacity: 0.2, pulseDelay: -8, pulseDuration: 12.5 },
  { id: "mediterranean", x: 555, y: 305, size: 3, opacity: 0.21, pulseDelay: -10, pulseDuration: 9.5 },
];

const ACTIVITY_ARCS: ActivityArc[] = [
  { id: "na-eu", path: "M 332 272 Q 430 190 500 278", delay: -12, duration: 16 },
  { id: "eu-east-africa", path: "M 500 280 Q 565 310 586 428", delay: -3, duration: 18 },
  { id: "middle-east-india", path: "M 610 332 Q 655 335 690 395", delay: -15, duration: 14 },
  { id: "india-sea", path: "M 690 395 Q 725 392 760 430", delay: -6, duration: 17 },
  { id: "east-asia-australia", path: "M 802 312 Q 860 450 882 648", delay: -10, duration: 19 },
  { id: "west-africa-south-cone", path: "M 500 425 Q 440 500 392 610", delay: -1, duration: 18 },
];

const PARTICLE_BASE_STYLE = (particle: Particle): CSSProperties => ({
  left: `${particle.left}%`,
  top: `${particle.top}%`,
  width: `${particle.size}px`,
  height: `${particle.size}px`,
  opacity: particle.opacity,
  animationDelay: `${particle.delay}s`,
  animationDuration: `${particle.duration}s`,
  ["--drift-x" as string]: `${particle.driftX}px`,
  ["--drift-y" as string]: `${particle.driftY}px`,
});

const ACTIVITY_NODE_STYLE = (node: ActivityNode): CSSProperties => ({
  ["--node-x" as string]: `${node.x}px`,
  ["--node-y" as string]: `${node.y}px`,
  ["--node-size" as string]: `${node.size}px`,
  ["--node-opacity" as string]: `${node.opacity}`,
  ["--pulse-delay" as string]: `${node.pulseDelay}s`,
  ["--pulse-duration" as string]: `${node.pulseDuration}s`,
});

const ACTIVITY_ARC_STYLE = (arc: ActivityArc): CSSProperties => ({
  ["--arc-delay" as string]: `${arc.delay}s`,
  ["--arc-duration" as string]: `${arc.duration}s`,
});

export function GlobalAtmosphereBackground() {
  const rootRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const root = rootRef.current;

    if (!root || typeof window === "undefined") {
      return;
    }

    const reducedMotionQuery = window.matchMedia("(prefers-reduced-motion: reduce)");
    let frame = 0;
    let targetX = 0;
    let targetY = 0;
    let currentX = 0;
    let currentY = 0;

    const setOffsets = (x: number, y: number) => {
      root.style.setProperty("--parallax-x", `${x.toFixed(2)}px`);
      root.style.setProperty("--parallax-y", `${y.toFixed(2)}px`);
    };

    const animate = () => {
      currentX += (targetX - currentX) * 0.06;
      currentY += (targetY - currentY) * 0.06;
      setOffsets(currentX, currentY);
      frame = window.requestAnimationFrame(animate);
    };

    const resetParallax = () => {
      targetX = 0;
      targetY = 0;
    };

    const handlePointerMove = (event: MouseEvent) => {
      if (reducedMotionQuery.matches) {
        return;
      }

      const normalizedX = event.clientX / window.innerWidth - 0.5;
      const normalizedY = event.clientY / window.innerHeight - 0.5;

      targetX = normalizedX * 18;
      targetY = normalizedY * 14;
    };

    const handleReducedMotionChange = () => {
      if (reducedMotionQuery.matches) {
        resetParallax();
      }
    };

    setOffsets(0, 0);
    frame = window.requestAnimationFrame(animate);
    window.addEventListener("mousemove", handlePointerMove, { passive: true });
    window.addEventListener("blur", resetParallax);
    document.addEventListener("mouseleave", resetParallax);
    reducedMotionQuery.addEventListener("change", handleReducedMotionChange);

    return () => {
      window.cancelAnimationFrame(frame);
      window.removeEventListener("mousemove", handlePointerMove);
      window.removeEventListener("blur", resetParallax);
      document.removeEventListener("mouseleave", resetParallax);
      reducedMotionQuery.removeEventListener("change", handleReducedMotionChange);
    };
  }, []);

  return (
    <div
      ref={rootRef}
      className="global-atmosphere-background"
      aria-hidden="true"
      role="presentation"
    >
      <div className="global-atmosphere-background__gradient">
        <div className="global-atmosphere-background__glow global-atmosphere-background__glow--primary" />
        <div className="global-atmosphere-background__glow global-atmosphere-background__glow--secondary" />
        <div className="global-atmosphere-background__glow global-atmosphere-background__glow--ambient" />
      </div>

      <div className="global-atmosphere-background__horizon" />

      <div className="global-atmosphere-background__activity-shell">
        <svg
          className="global-atmosphere-background__activity"
          viewBox="0 0 1000 1000"
          preserveAspectRatio="xMidYMid meet"
        >
          <defs>
            <radialGradient id="activityNodeGlow" cx="50%" cy="50%" r="50%">
              <stop offset="0%" stopColor="rgba(232,244,255,0.95)" />
              <stop offset="55%" stopColor="rgba(174,219,255,0.34)" />
              <stop offset="100%" stopColor="rgba(174,219,255,0)" />
            </radialGradient>
            <linearGradient id="activityArcStroke" x1="0%" y1="0%" x2="100%" y2="100%">
              <stop offset="0%" stopColor="rgba(255,255,255,0)" />
              <stop offset="50%" stopColor="rgba(177,220,255,0.52)" />
              <stop offset="100%" stopColor="rgba(255,255,255,0)" />
            </linearGradient>
          </defs>

          <g className="global-atmosphere-background__activity-arcs">
            {ACTIVITY_ARCS.map((arc) => (
              <path
                key={arc.id}
                d={arc.path}
                className="global-atmosphere-background__activity-arc"
                style={ACTIVITY_ARC_STYLE(arc)}
              />
            ))}
          </g>

          <g className="global-atmosphere-background__activity-nodes">
            {ACTIVITY_NODES.map((node) => (
              <g
                key={node.id}
                className="global-atmosphere-background__activity-node"
                style={ACTIVITY_NODE_STYLE(node)}
              >
                <circle className="global-atmosphere-background__activity-node-halo" cx="0" cy="0" r="12" />
                <circle className="global-atmosphere-background__activity-node-core" cx="0" cy="0" r="2.1" />
              </g>
            ))}
          </g>
        </svg>
      </div>

      <svg
        className="global-atmosphere-background__orbits"
        viewBox="0 0 1600 900"
        preserveAspectRatio="xMidYMid slice"
      >
        <defs>
          <linearGradient id="orbitStroke" x1="0%" y1="0%" x2="100%" y2="100%">
            <stop offset="0%" stopColor="rgba(255,255,255,0)" />
            <stop offset="40%" stopColor="rgba(176,218,255,0.28)" />
            <stop offset="65%" stopColor="rgba(227,239,255,0.2)" />
            <stop offset="100%" stopColor="rgba(255,255,255,0)" />
          </linearGradient>
        </defs>

        <g className="global-atmosphere-background__orbit-group global-atmosphere-background__orbit-group--slow">
          <ellipse cx="1080" cy="510" rx="620" ry="250" />
          <ellipse cx="940" cy="430" rx="510" ry="190" />
        </g>

        <g className="global-atmosphere-background__orbit-group global-atmosphere-background__orbit-group--reverse">
          <ellipse cx="1220" cy="600" rx="740" ry="285" />
          <ellipse cx="930" cy="610" rx="520" ry="220" />
        </g>
      </svg>

      <svg
        className="global-atmosphere-background__ribbons"
        viewBox="0 0 1600 900"
        preserveAspectRatio="xMidYMid slice"
      >
        <defs>
          <linearGradient id="ribbonGlowA" x1="0%" y1="0%" x2="100%" y2="0%">
            <stop offset="0%" stopColor="rgba(255,255,255,0)" />
            <stop offset="50%" stopColor="rgba(143,211,255,0.22)" />
            <stop offset="100%" stopColor="rgba(255,255,255,0)" />
          </linearGradient>
          <linearGradient id="ribbonGlowB" x1="0%" y1="0%" x2="100%" y2="100%">
            <stop offset="0%" stopColor="rgba(255,255,255,0)" />
            <stop offset="50%" stopColor="rgba(203,227,255,0.18)" />
            <stop offset="100%" stopColor="rgba(255,255,255,0)" />
          </linearGradient>
        </defs>

        <path
          className="global-atmosphere-background__ribbon global-atmosphere-background__ribbon--a"
          d="M -80 580 C 220 480, 360 640, 640 520 S 1160 320, 1700 430"
        />
        <path
          className="global-atmosphere-background__ribbon global-atmosphere-background__ribbon--b"
          d="M -120 280 C 210 180, 470 330, 760 260 S 1270 90, 1720 210"
        />
        <path
          className="global-atmosphere-background__ribbon global-atmosphere-background__ribbon--c"
          d="M 140 860 C 420 700, 670 760, 980 640 S 1370 430, 1680 520"
        />
      </svg>

      <div className="global-atmosphere-background__particles">
        {PARTICLES.map((particle, index) => (
          <span
            key={`${particle.left}-${particle.top}-${index}`}
            className="global-atmosphere-background__particle"
            style={PARTICLE_BASE_STYLE(particle)}
          />
        ))}
      </div>

      <div className="global-atmosphere-background__veil" />
    </div>
  );
}
