import React from 'react';
import { AlertCircle, X } from 'lucide-react';

/**
 * Converts technical error messages, error codes, and network exceptions
 * into clear, plain, user-friendly text suitable for general users.
 */
function sanitizeErrorMessage(error) {
  if (!error) return '';

  // If error is an Error object or Axios response
  let rawMessage = '';
  if (typeof error === 'string') {
    rawMessage = error;
  } else if (error?.response?.data?.message) {
    rawMessage = error.response.data.message;
  } else if (error?.response?.data?.error) {
    rawMessage = error.response.data.error;
  } else if (error?.message) {
    rawMessage = error.message;
  } else {
    return 'An unexpected error occurred. Please try again.';
  }

  const lower = rawMessage.toLowerCase();

  // Strip technical prefixes and codes
  if (lower.includes('network error') || lower.includes('econnrefused') || lower.includes('err_network')) {
    return 'Unable to reach the server. Please check your internet connection or try again shortly.';
  }
  if (lower.includes('timeout') || lower.includes('timed out')) {
    return 'The request took too long to complete. Please try again.';
  }
  if (lower.includes('401') || lower.includes('unauthorized') || lower.includes('token expired')) {
    return 'Your session has expired or is invalid. Please log in again.';
  }
  if (lower.includes('403') || lower.includes('forbidden')) {
    return 'You do not have permission to access this resource.';
  }
  if (lower.includes('404') || lower.includes('not found')) {
    return 'The requested resource could not be found.';
  }
  if (lower.includes('500') || lower.includes('internal server error')) {
    return 'Something went wrong on our end. Please try again in a few moments.';
  }
  if (lower.includes('rate limit') || lower.includes('429')) {
    return 'Too many requests. Please wait a moment before trying again.';
  }

  // Filter out any technical error code traces (e.g. [ERR_BAD_REQUEST], Status code 400)
  const cleaned = rawMessage
    .replace(/\[.*?\]/g, '')
    .replace(/status code \d+/gi, '')
    .replace(/error:\s*/gi, '')
    .trim();

  return cleaned || 'An error occurred. Please verify your details and try again.';
}

export default function ErrorBanner({ error, onClose }) {
  if (!error) return null;

  const displayMessage = sanitizeErrorMessage(error);
  if (!displayMessage) return null;

  return (
    <div
      role="alert"
      className="flex items-start justify-between gap-3 p-3.5 rounded-xl bg-red-500/10 border border-red-500/25 text-red-200 text-sm animate-in fade-in duration-200"
    >
      <div className="flex items-start gap-2.5">
        <AlertCircle className="w-5 h-5 text-red-400 shrink-0 mt-0.5" />
        <span className="leading-snug">{displayMessage}</span>
      </div>
      {onClose && (
        <button
          type="button"
          onClick={onClose}
          aria-label="Dismiss error"
          className="text-red-400/80 hover:text-red-200 p-0.5 rounded transition-colors shrink-0"
        >
          <X className="w-4 h-4" />
        </button>
      )}
    </div>
  );
}
