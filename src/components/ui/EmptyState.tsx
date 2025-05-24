import React from "react";
import { Alert, AlertTitle, AlertDescription } from "@/components/ui/alert";
import { HelpCircle, AlertTriangle } from "lucide-react";

export interface EmptyStateProps {
  /**
   * Main message or title for the empty state.
   * If not provided, a default will be used.
   */
  title?: string;
  /**
   * Description or body text for the empty state.
   */
  description?: React.ReactNode;
  /**
   * Optional icon to display. Defaults to HelpCircle.
   */
  icon?: React.ReactNode;
  /**
   * Optional: custom children to render instead of the default Alert layout.
   */
  children?: React.ReactNode;
  /**
   * Optional: className for the wrapper div.
   */
  className?: string;
}

/**
 * Shared EmptyState component for empty or no-data UI.
 *
 * Usage:
 * <EmptyState title="No Data" description="Add some items to get started!" />
 */
export const EmptyState: React.FC<EmptyStateProps> = ({
  title = "Nothing Here Yet",
  description = "There's no data to display.",
  icon,
  children,
  className = "",
}) => {
  if (children) {
    return <div className={className}>{children}</div>;
  }
  return (
    <div className={`flex justify-center items-center min-h-[200px] p-4 ${className}`}>
      <Alert variant="default" className="max-w-lg w-full text-center border-primary">
        {icon !== undefined ? icon : <HelpCircle className="h-8 w-8 text-primary mx-auto mb-2" />}
        <AlertTitle className="text-xl font-semibold">{title}</AlertTitle>
        <AlertDescription>{description}</AlertDescription>
      </Alert>
    </div>
  );
};

export default EmptyState;
