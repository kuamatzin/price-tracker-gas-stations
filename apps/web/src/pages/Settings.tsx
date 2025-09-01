const Settings = () => {
  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-gray-900 dark:text-white">
          Settings
        </h1>
        <p className="text-gray-600 dark:text-gray-400">
          Manage your account and preferences
        </p>
      </div>
      
      <div className="bg-white dark:bg-gray-800 p-6 rounded-lg shadow">
        <h2 className="text-xl font-semibold text-gray-900 dark:text-white mb-4">
          Account Settings
        </h2>
        <div className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300">
              Station Name
            </label>
            <input
              type="text"
              className="mt-1 block w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-brand-500 focus:border-brand-500"
              placeholder="Enter station name"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300">
              Notification Preferences
            </label>
            <div className="mt-2 space-y-2">
              <label className="flex items-center">
                <input type="checkbox" className="rounded" />
                <span className="ml-2 text-sm text-gray-600 dark:text-gray-400">
                  Email notifications
                </span>
              </label>
              <label className="flex items-center">
                <input type="checkbox" className="rounded" />
                <span className="ml-2 text-sm text-gray-600 dark:text-gray-400">
                  Push notifications
                </span>
              </label>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default Settings;