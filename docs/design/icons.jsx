// Lucide icon wrapper for React.
// Loads icons from the lucide UMD bundle and renders SVG inline.

const Icon = ({ name, size = 18, strokeWidth = 1.75, className = "", style }) => {
  const lib = (typeof window !== 'undefined' && window.lucide) ? window.lucide : null;
  if (!lib || !lib.icons) {
    return <span className={className} style={{ display: 'inline-block', width: size, height: size, ...style }} />;
  }
  // lucide stores icons by PascalCase
  const pascal = name.split('-').map(s => s[0].toUpperCase() + s.slice(1)).join('');
  const node = lib.icons[pascal] || lib.icons.HelpCircle || lib.icons.Circle;
  if (!node) return <span className={className} style={{ width: size, height: size }} />;

  // node format: ['svg', svgAttrs, children] OR { toSvg } OR array of children only depending on version
  let children = [];
  if (Array.isArray(node)) {
    if (node.length === 3 && Array.isArray(node[2])) children = node[2];
    else children = node;
  } else if (node && Array.isArray(node.children)) {
    children = node.children;
  }

  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={strokeWidth}
      strokeLinecap="round"
      strokeLinejoin="round"
      className={`orion-icon ${className}`}
      style={{ flexShrink: 0, ...style }}
      aria-hidden="true"
    >
      {children.map((child, i) => {
        const [tag, attrs] = child;
        return React.createElement(tag, { key: i, ...attrs });
      })}
    </svg>
  );
};

window.Icon = Icon;
