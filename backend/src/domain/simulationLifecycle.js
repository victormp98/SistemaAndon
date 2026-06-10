const transitions = Object.freeze({
  draft: Object.freeze(['ready', 'cancelled']),
  ready: Object.freeze(['draft', 'running', 'cancelled']),
  running: Object.freeze(['paused', 'completed', 'cancelled']),
  paused: Object.freeze(['running', 'completed', 'cancelled']),
  completed: Object.freeze([]),
  cancelled: Object.freeze([])
});

function canTransition(current, target) {
  return transitions[current]?.includes(target) || false;
}

module.exports = { transitions, canTransition };
