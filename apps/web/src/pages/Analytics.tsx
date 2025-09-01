const Analytics = () => {
  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-gray-900 dark:text-white">
          Analytics
        </h1>
        <p className="text-gray-600 dark:text-gray-400">
          Insights, trends, and competitive analysis
        </p>
      </div>
      
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <div className="bg-white dark:bg-gray-800 p-6 rounded-lg shadow">
          <h2 className="text-xl font-semibold text-gray-900 dark:text-white mb-4">
            Revenue Trends
          </h2>
          <p className="text-gray-600 dark:text-gray-400">
            Charts and graphs will be displayed here
          </p>
        </div>
        
        <div className="bg-white dark:bg-gray-800 p-6 rounded-lg shadow">
          <h2 className="text-xl font-semibold text-gray-900 dark:text-white mb-4">
            Market Position
          </h2>
          <p className="text-gray-600 dark:text-gray-400">
            Your position relative to competitors
          </p>
        </div>
      </div>
    </div>
  );
};

export default Analytics;