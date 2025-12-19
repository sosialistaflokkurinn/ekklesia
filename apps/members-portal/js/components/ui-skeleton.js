/**
 * Skeleton Loading Components
 *
 * Provides skeleton placeholders for loading states.
 * Shows content structure while data is being fetched.
 *
 * @module components/ui-skeleton
 */

/**
 * Create a skeleton element with animation
 *
 * @param {Object} options - Skeleton options
 * @param {string} options.type - Type: 'text', 'circle', 'rect', 'card'
 * @param {string} options.width - Width (CSS value, default: '100%')
 * @param {string} options.height - Height (CSS value)
 * @param {number} options.lines - Number of text lines (for type='text')
 * @returns {HTMLElement} Skeleton element
 *
 * @example
 * // Single line skeleton
 * const skeleton = createSkeleton({ type: 'text' });
 *
 * // Multi-line text
 * const textSkeleton = createSkeleton({ type: 'text', lines: 3 });
 *
 * // Avatar circle
 * const avatarSkeleton = createSkeleton({ type: 'circle', width: '40px' });
 */
export function createSkeleton(options = {}) {
  const {
    type = 'text',
    width = '100%',
    height,
    lines = 1
  } = options;

  if (type === 'text' && lines > 1) {
    const container = document.createElement('div');
    container.className = 'skeleton-container';
    for (let i = 0; i < lines; i++) {
      const line = createSkeletonLine(i === lines - 1 ? '70%' : '100%');
      container.appendChild(line);
    }
    return container;
  }

  const element = document.createElement('div');
  element.className = `skeleton skeleton-${type}`;
  element.style.width = width;

  if (height) {
    element.style.height = height;
  } else {
    // Default heights by type
    switch (type) {
      case 'text':
        element.style.height = '1em';
        break;
      case 'circle':
        element.style.height = width;
        element.style.borderRadius = '50%';
        break;
      case 'rect':
        element.style.height = '100px';
        break;
      case 'card':
        element.style.height = '200px';
        break;
    }
  }

  return element;
}

/**
 * Create a single skeleton text line
 * @param {string} width - Line width
 * @returns {HTMLElement}
 */
function createSkeletonLine(width) {
  const line = document.createElement('div');
  line.className = 'skeleton skeleton-text';
  line.style.width = width;
  line.style.height = '1em';
  line.style.marginBottom = '0.5em';
  return line;
}

/**
 * Create a skeleton for a table row
 *
 * @param {number} columns - Number of columns
 * @returns {HTMLElement} Table row skeleton
 */
export function createTableRowSkeleton(columns = 4) {
  const row = document.createElement('tr');
  row.className = 'skeleton-row';

  for (let i = 0; i < columns; i++) {
    const cell = document.createElement('td');
    const skeleton = createSkeleton({ type: 'text' });
    cell.appendChild(skeleton);
    row.appendChild(cell);
  }

  return row;
}

/**
 * Create a skeleton for a card component
 *
 * @param {Object} options - Card options
 * @param {boolean} options.hasImage - Include image placeholder
 * @param {boolean} options.hasAvatar - Include avatar
 * @param {number} options.textLines - Number of text lines
 * @returns {HTMLElement} Card skeleton
 */
export function createCardSkeleton(options = {}) {
  const {
    hasImage = false,
    hasAvatar = false,
    textLines = 3
  } = options;

  const card = document.createElement('div');
  card.className = 'skeleton-card';

  if (hasImage) {
    const image = createSkeleton({ type: 'rect', height: '150px' });
    card.appendChild(image);
  }

  const content = document.createElement('div');
  content.className = 'skeleton-card-content';
  content.style.padding = '1rem';

  if (hasAvatar) {
    const header = document.createElement('div');
    header.style.display = 'flex';
    header.style.alignItems = 'center';
    header.style.marginBottom = '1rem';

    const avatar = createSkeleton({ type: 'circle', width: '40px' });
    avatar.style.marginRight = '0.75rem';
    header.appendChild(avatar);

    const name = createSkeleton({ type: 'text', width: '120px' });
    header.appendChild(name);

    content.appendChild(header);
  }

  const text = createSkeleton({ type: 'text', lines: textLines });
  content.appendChild(text);

  card.appendChild(content);
  return card;
}

/**
 * Create a skeleton for election list item
 *
 * @returns {HTMLElement} Election skeleton
 */
export function createElectionSkeleton() {
  const item = document.createElement('div');
  item.className = 'skeleton-election';
  item.style.padding = '1rem';
  item.style.borderBottom = '1px solid var(--color-border, #e0e0e0)';

  // Title
  const title = createSkeleton({ type: 'text', width: '60%' });
  title.style.marginBottom = '0.5rem';
  title.style.height = '1.25em';
  item.appendChild(title);

  // Date and status
  const meta = document.createElement('div');
  meta.style.display = 'flex';
  meta.style.gap = '1rem';

  const date = createSkeleton({ type: 'text', width: '100px' });
  const status = createSkeleton({ type: 'text', width: '80px' });
  meta.appendChild(date);
  meta.appendChild(status);
  item.appendChild(meta);

  return item;
}

/**
 * Create a skeleton for member list item
 *
 * @returns {HTMLElement} Member skeleton
 */
export function createMemberSkeleton() {
  const item = document.createElement('div');
  item.className = 'skeleton-member';
  item.style.display = 'flex';
  item.style.alignItems = 'center';
  item.style.padding = '0.75rem';
  item.style.borderBottom = '1px solid var(--color-border, #e0e0e0)';

  // Avatar
  const avatar = createSkeleton({ type: 'circle', width: '36px' });
  avatar.style.marginRight = '0.75rem';
  avatar.style.flexShrink = '0';
  item.appendChild(avatar);

  // Info
  const info = document.createElement('div');
  info.style.flex = '1';

  const name = createSkeleton({ type: 'text', width: '150px' });
  name.style.marginBottom = '0.25rem';
  info.appendChild(name);

  const email = createSkeleton({ type: 'text', width: '200px' });
  email.appendChild(email);
  info.appendChild(email);

  item.appendChild(info);

  return item;
}

/**
 * Show skeleton loading state in a container
 *
 * @param {HTMLElement} container - Container element
 * @param {Object} options - Options
 * @param {string} options.type - Skeleton type: 'list', 'table', 'cards'
 * @param {number} options.count - Number of skeleton items
 *
 * @example
 * // Show loading state
 * showSkeleton(listContainer, { type: 'list', count: 5 });
 *
 * // Fetch data
 * const data = await fetchData();
 *
 * // Replace with actual content
 * listContainer.innerHTML = '';
 * data.forEach(item => listContainer.appendChild(createItem(item)));
 */
export function showSkeleton(container, options = {}) {
  const {
    type = 'list',
    count = 3
  } = options;

  container.innerHTML = '';
  container.setAttribute('aria-busy', 'true');
  container.setAttribute('aria-label', 'Hleður...');

  for (let i = 0; i < count; i++) {
    let skeleton;
    switch (type) {
      case 'table':
        skeleton = createTableRowSkeleton();
        break;
      case 'cards':
        skeleton = createCardSkeleton({ hasImage: true, textLines: 2 });
        break;
      case 'elections':
        skeleton = createElectionSkeleton();
        break;
      case 'members':
        skeleton = createMemberSkeleton();
        break;
      default:
        skeleton = createSkeleton({ type: 'text', lines: 2 });
        skeleton.style.marginBottom = '1rem';
    }
    container.appendChild(skeleton);
  }
}

/**
 * Hide skeleton and show actual content
 *
 * @param {HTMLElement} container - Container element
 */
export function hideSkeleton(container) {
  container.removeAttribute('aria-busy');
  container.removeAttribute('aria-label');
}
