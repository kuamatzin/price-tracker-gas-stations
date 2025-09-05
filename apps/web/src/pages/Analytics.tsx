import { Link } from 'react-router-dom';
import { TrendingUp, BarChart3 } from 'lucide-react';

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
        <Link 
          to="/analytics/trends" 
          className="bg-white dark:bg-gray-800 p-6 rounded-lg shadow hover:shadow-md transition-shadow block"
        >
          <div className="flex items-center mb-4">
            <TrendingUp className="w-6 h-6 text-blue-600 mr-3" />
            <h2 className="text-xl font-semibold text-gray-900 dark:text-white">
              Tendencias Históricas
            </h2>
          </div>
          <p className="text-gray-600 dark:text-gray-400">
            Analiza la evolución de precios en el tiempo con gráficos interactivos
          </p>
        </Link>
        
        <div className="bg-white dark:bg-gray-800 p-6 rounded-lg shadow opacity-50">
          <div className="flex items-center mb-4">
            <BarChart3 className="w-6 h-6 text-gray-400 mr-3" />
            <h2 className="text-xl font-semibold text-gray-500 dark:text-gray-500">
              Posición de Mercado
            </h2>
          </div>
          <p className="text-gray-400 dark:text-gray-500">
            Próximamente: Tu posición relativa a la competencia
          </p>
        </div>
      </div>
    </div>
  );
};

export default Analytics;