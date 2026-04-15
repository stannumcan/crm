"use client";

export default function CostCalcError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  return (
    <div className="p-6 max-w-2xl">
      <div className="rounded-md bg-red-50 border border-red-200 px-4 py-4 space-y-2">
        <p className="font-semibold text-red-800">Error loading Cost Calc</p>
        <p className="text-sm text-red-700 font-mono break-all">{error.message}</p>
        {error.digest && <p className="text-xs text-red-500">Digest: {error.digest}</p>}
        <pre className="text-xs text-red-600 whitespace-pre-wrap overflow-auto max-h-64">
          {error.stack}
        </pre>
        <button
          type="button"
          onClick={reset}
          className="text-sm bg-red-600 text-white rounded px-3 py-1 hover:bg-red-700 transition-colors"
        >
          Try again
        </button>
      </div>
    </div>
  );
}
