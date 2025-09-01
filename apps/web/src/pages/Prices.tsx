const Prices = () => {
  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-gray-900 dark:text-white">
          Price Management
        </h1>
        <p className="text-gray-600 dark:text-gray-400">
          Manage your fuel prices and monitor competitors
        </p>
      </div>
      
      <div className="bg-white dark:bg-gray-800 p-6 rounded-lg shadow">
        <h2 className="text-xl font-semibold text-gray-900 dark:text-white mb-4">
          Current Prices
        </h2>
        <div className="space-y-4">
          <div className="flex items-center justify-between p-4 bg-gray-50 dark:bg-gray-700 rounded-lg">
            <span className="text-gray-900 dark:text-white font-medium">Regular</span>
            <span className="text-lg font-bold text-gray-900 dark:text-white">$3.45</span>
          </div>
          <div className="flex items-center justify-between p-4 bg-gray-50 dark:bg-gray-700 rounded-lg">
            <span className="text-gray-900 dark:text-white font-medium">Premium</span>
            <span className="text-lg font-bold text-gray-900 dark:text-white">$3.75</span>
          </div>
          <div className="flex items-center justify-between p-4 bg-gray-50 dark:bg-gray-700 rounded-lg">
            <span className="text-gray-900 dark:text-white font-medium">Diesel</span>
            <span className="text-lg font-bold text-gray-900 dark:text-white">$3.25</span>
          </div>
        </div>
      </div>
    </div>
  );
};

export default Prices;