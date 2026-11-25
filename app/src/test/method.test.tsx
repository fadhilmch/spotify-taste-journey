import { describe, expect, it } from 'vitest';
import { render, screen } from '@testing-library/react';
import { MethodView } from '../ui/MethodView';

describe('MethodView', () => {
  it('states the counting rules', () => {
    render(<MethodView />);
    expect(screen.getByRole('heading', { name: 'Story chapters' })).toBeInTheDocument();
    expect(screen.getByText(/25% or more/)).toBeInTheDocument();
    expect(screen.getByText(/10% to 25%/)).toBeInTheDocument();
    expect(screen.getByText(/30 minutes without a play/)).toBeInTheDocument();
    expect(screen.getByText(/CC BY-NC-SA 3.0/)).toBeInTheDocument();
    // Moved here from the country-map caption.
    expect(screen.getByText(/name match, not a verified/)).toBeInTheDocument();
  });
});
