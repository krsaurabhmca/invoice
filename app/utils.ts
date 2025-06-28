export const networkErrorMessage = (error: any): string => {
  const msg = String(error?.message || '');
  if (msg.includes('Network request failed') || msg.includes('Failed to fetch')) {
    return 'No internet connection. Please check your network.';
  }
  return 'Network error. Please try again.';
};
