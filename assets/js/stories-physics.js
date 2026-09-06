// D3 supplies the soft spring motion. These position constraints make the
// geometry we actually paint obey the same circles and container on every frame.
export function contactError(nodes, width, height, padding, gap) {
  let error = 0;
  for (let i = 0; i < nodes.length; i += 1) {
    const a = nodes[i];
    if (![a.x, a.y, a.currentRadius].every(Number.isFinite)) return Infinity;
    const radius = a.currentRadius;
    error = Math.max(error, radius + padding - a.x, a.x + radius + padding - width,
      radius + padding - a.y, a.y + radius + padding - height);
    for (let j = i + 1; j < nodes.length; j += 1) {
      const b = nodes[j];
      error = Math.max(error, radius + b.currentRadius + gap - Math.hypot(b.x - a.x, b.y - a.y));
    }
  }
  return error;
}

function clampToWalls(node, width, height, padding) {
  const radius = node.currentRadius + padding;
  node.x = Math.max(radius, Math.min(width - radius, node.x));
  node.y = Math.max(radius, Math.min(height - radius, node.y));
}

function inverseMass(node) {
  // Larger circles carry more mass, but no circle is an immovable obstacle.
  return (node.isCore ? .8 : 1) * (node.activeAnchor ? .3 : 1) / Math.max(1, (node.currentRadius / 50) ** 2);
}

function resolveVelocities(nodes, width, height, padding, gap) {
  for (let i = 0; i < nodes.length; i += 1) {
    const a = nodes[i];
    const edge = a.currentRadius + padding;
    if (a.x <= edge + .02 && a.vx < 0 || a.x >= width - edge - .02 && a.vx > 0) a.vx = 0;
    if (a.y <= edge + .02 && a.vy < 0 || a.y >= height - edge - .02 && a.vy > 0) a.vy = 0;
    for (let j = i + 1; j < nodes.length; j += 1) {
      const b = nodes[j];
      const dx = b.x - a.x; const dy = b.y - a.y; const distance = Math.hypot(dx, dy);
      if (!distance || distance > a.currentRadius + b.currentRadius + gap + .02) continue;
      const nx = dx / distance; const ny = dy / distance;
      const closing = (b.vx - a.vx) * nx + (b.vy - a.vy) * ny;
      if (closing >= 0) continue;
      const weightA = inverseMass(a); const weightB = inverseMass(b);
      const impulse = -closing / (weightA + weightB);
      a.vx -= nx * impulse * weightA; a.vy -= ny * impulse * weightA;
      b.vx += nx * impulse * weightB; b.vy += ny * impulse * weightB;
    }
  }
}

export function solveContacts(nodes, width, height, padding, gap, maxIterations = 120) {
  const tolerance = .005;
  if (!Number.isFinite(width) || !Number.isFinite(height) || nodes.some((node) =>
    ![node.x, node.y, node.currentRadius].every(Number.isFinite) || node.currentRadius < 0 ||
    2 * (node.currentRadius + padding) > Math.min(width, height))) return false;

  for (let iteration = 0; iteration < maxIterations; iteration += 1) {
    nodes.forEach((node) => clampToWalls(node, width, height, padding));
    // Alternating traversal avoids giving the same end of a contact chain
    // priority on every iteration, especially where a chain meets a wall.
    const reverse = iteration % 2;
    for (let ii = 0; ii < nodes.length; ii += 1) {
      const i = reverse ? nodes.length - 1 - ii : ii;
      for (let jj = ii + 1; jj < nodes.length; jj += 1) {
        const j = reverse ? nodes.length - 1 - jj : jj;
        const a = nodes[i]; const b = nodes[j];
        let dx = b.x - a.x; let dy = b.y - a.y; let distance = Math.hypot(dx, dy);
        const penetration = a.currentRadius + b.currentRadius + gap - distance;
        if (penetration <= 0) continue;
        if (distance < 1e-8) {
          // Coincident centres need a deterministic normal instead of NaN.
          const angle = (Math.min(i, j) * 17 + Math.max(i, j) * 31) * 2.399963229728653;
          dx = Math.cos(angle); dy = Math.sin(angle); distance = 1;
        }
        const nx = dx / distance; const ny = dy / distance;
        const weightA = inverseMass(a); const weightB = inverseMass(b);
        const correction = (penetration + .0005) / (weightA + weightB);
        a.x -= nx * correction * weightA; a.y -= ny * correction * weightA;
        b.x += nx * correction * weightB; b.y += ny * correction * weightB;
        clampToWalls(a, width, height, padding); clampToWalls(b, width, height, padding);
      }
    }
    if (contactError(nodes, width, height, padding, gap) <= tolerance) {
      resolveVelocities(nodes, width, height, padding, gap);
      return true;
    }
  }
  return false;
}

// Used only when a new container cannot be solved from the previous layout.
// Rows of bounding squares are a constructive, verifiably feasible fallback;
// the normal spring targets immediately recover the authored composition.
export function arrangeInRows(nodes, width, height, padding, gap) {
  const innerWidth = width - padding * 2; const innerHeight = height - padding * 2;
  if (innerWidth <= 0 || innerHeight <= gap * (nodes.length - 1)) return null;
  const ordered = [...nodes].sort((a, b) => b.currentRadius - a.currentRadius || a.id.localeCompare(b.id));
  let scale = Math.min(1, innerWidth / (2 * Math.max(...nodes.map((node) => node.currentRadius))));
  for (let attempt = 0; attempt < 160; attempt += 1) {
    const rows = [];
    for (const node of ordered) {
      const diameter = node.currentRadius * 2 * scale;
      let row = rows.filter((candidate) => candidate.width + gap + diameter <= innerWidth + 1e-8)
        .sort((a, b) => b.width - a.width)[0];
      if (!row) { row = { nodes: [], width: 0, height: diameter }; rows.push(row); }
      row.width += (row.nodes.length ? gap : 0) + diameter; row.nodes.push(node);
    }
    const usedHeight = rows.reduce((sum, row) => sum + row.height, 0) + gap * (rows.length - 1);
    if (usedHeight <= innerHeight) {
      let y = padding + (innerHeight - usedHeight) / 2;
      for (const row of rows) {
        let x = padding + (innerWidth - row.width) / 2;
        for (const node of row.nodes) {
          node.currentRadius *= scale;
          node.x = x + node.currentRadius; node.y = y + row.height / 2;
          node.vx = 0; node.vy = 0; x += node.currentRadius * 2 + gap;
        }
        y += row.height + gap;
      }
      return scale;
    }
    scale *= .94;
  }
  return null;
}
