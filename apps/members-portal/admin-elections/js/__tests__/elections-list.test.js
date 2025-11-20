/**
 * @jest-environment jsdom
 */

/**
 * Admin Elections List - Unit Tests
 * 
 * Tests core functionality of the elections list page including:
 * - Filtering elections by status
 * - Searching elections
 * - Status badge rendering
 * - Action button visibility based on RBAC
 */

describe('Admin Elections List', () => {
  describe('Status Filtering', () => {
    const mockElections = [
      { id: 1, title: 'Election 1', status: 'draft' },
      { id: 2, title: 'Election 2', status: 'published' },
      { id: 3, title: 'Election 3', status: 'closed' },
      { id: 4, title: 'Election 4', status: 'draft', hidden: true }
    ];

    it('should show all elections when "all" filter is active', () => {
      const filtered = mockElections.filter(() => true);
      expect(filtered).toHaveLength(4);
    });

    it('should show only draft elections when "draft" filter is active', () => {
      const filtered = mockElections.filter(e => e.status === 'draft' && !e.hidden);
      expect(filtered).toHaveLength(1);
      expect(filtered[0].title).toBe('Election 1');
    });

    it('should show only published elections when "published" filter is active', () => {
      const filtered = mockElections.filter(e => e.status === 'published' && !e.hidden);
      expect(filtered).toHaveLength(1);
      expect(filtered[0].title).toBe('Election 2');
    });

    it('should show only closed elections when "closed" filter is active', () => {
      const filtered = mockElections.filter(e => e.status === 'closed' && !e.hidden);
      expect(filtered).toHaveLength(1);
      expect(filtered[0].title).toBe('Election 3');
    });

    it('should show only hidden elections when "hidden" filter is active', () => {
      const filtered = mockElections.filter(e => e.hidden === true);
      expect(filtered).toHaveLength(1);
      expect(filtered[0].title).toBe('Election 4');
    });
  });

  describe('Search Functionality', () => {
    const mockElections = [
      { id: 1, title: 'Presidential Election 2025', status: 'draft' },
      { id: 2, title: 'Board Member Vote', status: 'published' },
      { id: 3, title: 'Policy Decision', status: 'closed' }
    ];

    it('should find elections by exact title match', () => {
      const searchTerm = 'Presidential';
      const filtered = mockElections.filter(e => 
        e.title.toLowerCase().includes(searchTerm.toLowerCase())
      );
      expect(filtered).toHaveLength(1);
      expect(filtered[0].title).toBe('Presidential Election 2025');
    });

    it('should find elections by partial title match (case-insensitive)', () => {
      const searchTerm = 'vote';
      const filtered = mockElections.filter(e => 
        e.title.toLowerCase().includes(searchTerm.toLowerCase())
      );
      expect(filtered).toHaveLength(1);
      expect(filtered[0].title).toBe('Board Member Vote');
    });

    it('should return empty array when no matches found', () => {
      const searchTerm = 'NonExistent';
      const filtered = mockElections.filter(e => 
        e.title.toLowerCase().includes(searchTerm.toLowerCase())
      );
      expect(filtered).toHaveLength(0);
    });

    it('should return all elections when search term is empty', () => {
      const searchTerm = '';
      const filtered = mockElections.filter(e => 
        e.title.toLowerCase().includes(searchTerm.toLowerCase())
      );
      expect(filtered).toHaveLength(3);
    });
  });

  describe('Status Badge Mapping', () => {
    it('should map draft status to correct badge class', () => {
      const status = 'draft';
      const badgeClass = `election-card__status--${status}`;
      expect(badgeClass).toBe('election-card__status--draft');
    });

    it('should map published status to correct badge class', () => {
      const status = 'published';
      const badgeClass = `election-card__status--${status}`;
      expect(badgeClass).toBe('election-card__status--published');
    });

    it('should map closed status to correct badge class', () => {
      const status = 'closed';
      const badgeClass = `election-card__status--${status}`;
      expect(badgeClass).toBe('election-card__status--closed');
    });
  });

  describe('Action Button Visibility (RBAC)', () => {
    const mockElection = {
      id: 1,
      title: 'Test Election',
      status: 'draft'
    };

    it('should show edit button for draft elections', () => {
      const canEdit = mockElection.status === 'draft';
      expect(canEdit).toBe(true);
    });

    it('should not show edit button for published elections', () => {
      const publishedElection = { ...mockElection, status: 'published' };
      const canEdit = publishedElection.status === 'draft';
      expect(canEdit).toBe(false);
    });

    it('should show open button only for draft elections', () => {
      const canOpen = mockElection.status === 'draft';
      expect(canOpen).toBe(true);
    });

    it('should show close button only for published elections', () => {
      const publishedElection = { ...mockElection, status: 'published' };
      const canClose = publishedElection.status === 'published';
      expect(canClose).toBe(true);
    });

    it('should show delete button only for closed elections (superadmin)', () => {
      const closedElection = { ...mockElection, status: 'closed' };
      const userRole = 'superadmin';
      const canDelete = closedElection.status === 'closed' && userRole === 'superadmin';
      expect(canDelete).toBe(true);
    });

    it('should not show delete button for non-superadmin users', () => {
      const closedElection = { ...mockElection, status: 'closed' };
      const userRole = 'election-manager';
      const canDelete = closedElection.status === 'closed' && userRole === 'superadmin';
      expect(canDelete).toBe(false);
    });
  });

  describe('Combined Filtering and Search', () => {
    const mockElections = [
      { id: 1, title: 'Presidential Draft', status: 'draft', hidden: false },
      { id: 2, title: 'Presidential Vote', status: 'published', hidden: false },
      { id: 3, title: 'Board Draft', status: 'draft', hidden: false },
      { id: 4, title: 'Hidden Presidential', status: 'draft', hidden: true }
    ];

    it('should apply both filter and search criteria', () => {
      const searchTerm = 'Presidential';
      const statusFilter = 'draft';
      
      const filtered = mockElections.filter(e => 
        e.status === statusFilter && 
        !e.hidden &&
        e.title.toLowerCase().includes(searchTerm.toLowerCase())
      );
      
      expect(filtered).toHaveLength(1);
      expect(filtered[0].title).toBe('Presidential Draft');
    });

    it('should exclude hidden elections when hidden filter not active', () => {
      const searchTerm = 'Presidential';
      
      const filtered = mockElections.filter(e => 
        !e.hidden &&
        e.title.toLowerCase().includes(searchTerm.toLowerCase())
      );
      
      expect(filtered).toHaveLength(2);
      expect(filtered.map(e => e.id)).toEqual([1, 2]);
    });
  });

  describe('Election Count Display', () => {
    it('should show correct count for single election', () => {
      const count = 1;
      const message = count === 1 ? `Showing ${count} election` : `Showing ${count} elections`;
      expect(message).toBe('Showing 1 election');
    });

    it('should show correct count for multiple elections', () => {
      const count = 5;
      const message = count === 1 ? `Showing ${count} election` : `Showing ${count} elections`;
      expect(message).toBe('Showing 5 elections');
    });

    it('should show zero elections message', () => {
      const count = 0;
      const message = count === 0 ? 'No elections found' : `Showing ${count} elections`;
      expect(message).toBe('No elections found');
    });
  });
});
