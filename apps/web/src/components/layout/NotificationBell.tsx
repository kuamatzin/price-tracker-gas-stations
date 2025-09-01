import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { useAlertStore } from '@/stores/alertStore';

const BellIcon = ({ className }: { className?: string }) => (
  <svg className={className} fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor">
    <path strokeLinecap="round" strokeLinejoin="round" d="M14.857 17.082a23.848 23.848 0 005.454-1.31A8.967 8.967 0 0118 9.75v-.7V9A6 6 0 006 9v.75a8.967 8.967 0 01-2.312 6.022c1.733.64 3.56 1.085 5.455 1.31m5.714 0a24.255 24.255 0 01-5.714 0m5.714 0a3 3 0 11-5.714 0" />
  </svg>
);

const CheckIcon = ({ className }: { className?: string }) => (
  <svg className={className} fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor">
    <path strokeLinecap="round" strokeLinejoin="round" d="M4.5 12.75l6 6 9-13.5" />
  </svg>
);

interface NotificationBellProps {
  count: number;
}

export const NotificationBell = ({ count }: NotificationBellProps) => {
  const [isOpen, setIsOpen] = useState(false);
  const { alerts, markAsRead, markAllAsRead } = useAlertStore();

  const recentAlerts = alerts.slice(0, 5); // Show only 5 most recent

  return (
    <div className="relative">
      <Button
        variant="ghost"
        size="sm"
        onClick={() => setIsOpen(!isOpen)}
        className="relative"
      >
        <BellIcon className="h-5 w-5" />
        {count > 0 && (
          <Badge 
            variant="destructive"
            className="absolute -top-1 -right-1 h-5 w-5 p-0 text-xs flex items-center justify-center"
          >
            {count > 9 ? '9+' : count}
          </Badge>
        )}
      </Button>

      {/* Dropdown panel */}
      {isOpen && (
        <>
          <div
            className="fixed inset-0 z-10"
            onClick={() => setIsOpen(false)}
          />
          <div className="absolute right-0 z-20 mt-2 w-80 origin-top-right rounded-md bg-white dark:bg-gray-800 shadow-lg ring-1 ring-black ring-opacity-5 focus:outline-none">
            <div className="py-1">
              {/* Header */}
              <div className="flex items-center justify-between px-4 py-3 border-b border-gray-100 dark:border-gray-700">
                <h3 className="text-sm font-medium text-gray-900 dark:text-white">
                  Notifications
                </h3>
                {count > 0 && (
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => {
                      markAllAsRead();
                      setIsOpen(false);
                    }}
                    className="text-xs"
                  >
                    Mark all read
                  </Button>
                )}
              </div>

              {/* Notifications list */}
              <div className="max-h-96 overflow-y-auto">
                {recentAlerts.length === 0 ? (
                  <div className="px-4 py-6 text-center">
                    <BellIcon className="mx-auto h-8 w-8 text-gray-400 dark:text-gray-500" />
                    <p className="mt-2 text-sm text-gray-500 dark:text-gray-400">
                      No notifications
                    </p>
                  </div>
                ) : (
                  <div className="py-1">
                    {recentAlerts.map((alert) => (
                      <div
                        key={alert.id}
                        className={`px-4 py-3 border-b border-gray-50 dark:border-gray-700 last:border-b-0 hover:bg-gray-50 dark:hover:bg-gray-700 cursor-pointer ${
                          !alert.read ? 'bg-blue-50 dark:bg-blue-900/20' : ''
                        }`}
                        onClick={() => {
                          if (!alert.read) {
                            markAsRead(alert.id);
                          }
                        }}
                      >
                        <div className="flex items-start space-x-3">
                          <div className={`
                            flex-shrink-0 w-2 h-2 rounded-full mt-2
                            ${alert.severity === 'critical' ? 'bg-red-500' :
                              alert.severity === 'high' ? 'bg-orange-500' :
                              alert.severity === 'medium' ? 'bg-yellow-500' :
                              'bg-blue-500'}
                          `} />
                          <div className="flex-1 min-w-0">
                            <p className="text-sm font-medium text-gray-900 dark:text-white">
                              {alert.title}
                            </p>
                            <p className="text-sm text-gray-500 dark:text-gray-400 line-clamp-2">
                              {alert.message}
                            </p>
                            <p className="text-xs text-gray-400 dark:text-gray-500 mt-1">
                              {new Date(alert.timestamp).toLocaleString()}
                            </p>
                          </div>
                          {!alert.read && (
                            <div className="flex-shrink-0">
                              <div className="w-2 h-2 bg-blue-500 rounded-full"></div>
                            </div>
                          )}
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>

              {/* Footer */}
              {recentAlerts.length > 0 && (
                <div className="border-t border-gray-100 dark:border-gray-700 px-4 py-2">
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => setIsOpen(false)}
                    className="w-full text-xs"
                  >
                    View all notifications
                  </Button>
                </div>
              )}
            </div>
          </div>
        </>
      )}
    </div>
  );
};