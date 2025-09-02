import { useState, useEffect } from "react"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { useAuthStore } from "@/stores/authStore"
import { 
  DollarSign, 
  TrendingUp, 
  TrendingDown, 
  Bell, 
  Eye, 
  Settings,
  Calendar,
  MapPin,
  Activity,
  AlertTriangle
} from "lucide-react"

interface PriceSummary {
  fuelType: string
  currentPrice: number
  change: number
  trend: 'up' | 'down' | 'stable'
}

interface ActivityItem {
  id: string
  type: 'price_update' | 'competitor_change' | 'alert' | 'system'
  title: string
  description: string
  timestamp: string
  status?: 'info' | 'warning' | 'success' | 'error'
}

interface QuickAction {
  id: string
  title: string
  description: string
  icon: React.ElementType
  action: () => void
  disabled?: boolean
}

const Dashboard = () => {
  const { user } = useAuthStore()
  const [priceSummary, setPriceSummary] = useState<PriceSummary[]>([])
  const [recentActivity, setRecentActivity] = useState<ActivityItem[]>([])
  const [notifications, setNotifications] = useState(3)

  useEffect(() => {
    setPriceSummary([
      { fuelType: 'Magna', currentPrice: 22.85, change: -0.15, trend: 'down' },
      { fuelType: 'Premium', currentPrice: 24.50, change: 0.05, trend: 'up' },
      { fuelType: 'Diesel', currentPrice: 23.20, change: 0.0, trend: 'stable' },
    ])

    setRecentActivity([
      {
        id: '1',
        type: 'price_update',
        title: 'Precio actualizado',
        description: 'Magna actualizado a $22.85/L',
        timestamp: '2 min',
        status: 'success'
      },
      {
        id: '2',
        type: 'competitor_change',
        title: 'Competencia detectada',
        description: 'Estación vecina bajó precio Premium',
        timestamp: '15 min',
        status: 'warning'
      },
      {
        id: '3',
        type: 'alert',
        title: 'Alerta activada',
        description: 'Precio Diesel por debajo del promedio',
        timestamp: '1 hora',
        status: 'info'
      }
    ])
  }, [])

  const quickActions: QuickAction[] = [
    {
      id: 'update_prices',
      title: 'Actualizar Precios',
      description: 'Modifica los precios actuales',
      icon: DollarSign,
      action: () => console.log('Navigate to prices')
    },
    {
      id: 'view_analytics',
      title: 'Ver Análisis',
      description: 'Revisa tendencias y estadísticas',
      icon: TrendingUp,
      action: () => console.log('Navigate to analytics')
    },
    {
      id: 'check_competition',
      title: 'Competencia',
      description: 'Monitorea precios cercanos',
      icon: Eye,
      action: () => console.log('Navigate to competition')
    },
    {
      id: 'manage_alerts',
      title: 'Configurar Alertas',
      description: 'Gestiona notificaciones',
      icon: Bell,
      action: () => console.log('Navigate to alerts')
    }
  ]

  const getGreeting = () => {
    const hour = new Date().getHours()
    if (hour < 12) return 'Buenos días'
    if (hour < 18) return 'Buenas tardes'
    return 'Buenas noches'
  }

  return (
    <div className="space-y-6">
      {/* Welcome Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-3xl font-bold text-gray-900">
            {getGreeting()}, {user?.name}
          </h1>
          <div className="mt-1 flex items-center text-sm text-gray-600">
            <MapPin className="h-4 w-4 mr-1" />
            <span>
              {user?.station?.nombre || 'Sin estación asignada'} - {user?.station?.municipio}, {user?.station?.entidad}
            </span>
          </div>
        </div>
        <div className="mt-4 sm:mt-0 flex items-center space-x-2">
          <Badge variant="outline" className="capitalize">
            {user?.subscription_tier || 'básico'}
          </Badge>
          <Button variant="outline" size="sm">
            <Settings className="h-4 w-4 mr-2" />
            Configuración
          </Button>
        </div>
      </div>

      {/* Notifications Alert */}
      {notifications > 0 && (
        <Card className="border-amber-200 bg-amber-50">
          <CardContent className="flex items-center justify-between p-4">
            <div className="flex items-center">
              <AlertTriangle className="h-5 w-5 text-amber-600 mr-3" />
              <div>
                <p className="text-sm font-medium text-amber-800">
                  Tienes {notifications} notificaciones pendientes
                </p>
                <p className="text-xs text-amber-700">
                  Revisa las alertas de precios y competencia
                </p>
              </div>
            </div>
            <Button variant="outline" size="sm" className="border-amber-300 text-amber-700">
              Ver todas
            </Button>
          </CardContent>
        </Card>
      )}

      {/* Price Summary Cards */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        {priceSummary.map((price) => (
          <Card key={price.fuelType}>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium text-gray-600">
                {price.fuelType}
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="flex items-baseline justify-between">
                <div className="text-2xl font-bold">
                  ${price.currentPrice.toFixed(2)}
                </div>
                <div className={`flex items-center text-sm ${
                  price.trend === 'up' ? 'text-green-600' : 
                  price.trend === 'down' ? 'text-red-600' : 
                  'text-gray-500'
                }`}>
                  {price.trend === 'up' && <TrendingUp className="h-4 w-4 mr-1" />}
                  {price.trend === 'down' && <TrendingDown className="h-4 w-4 mr-1" />}
                  {price.change !== 0 ? `$${Math.abs(price.change).toFixed(2)}` : 'Sin cambio'}
                </div>
              </div>
              <p className="text-xs text-gray-500 mt-1">Por litro</p>
            </CardContent>
          </Card>
        ))}
      </div>

      {/* Main Dashboard Grid */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Quick Actions */}
        <div className="lg:col-span-2">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center">
                <Activity className="h-5 w-5 mr-2" />
                Acciones Rápidas
              </CardTitle>
              <CardDescription>
                Acceso rápido a las funciones principales
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                {quickActions.map((action) => (
                  <Card key={action.id} className="cursor-pointer hover:bg-gray-50 transition-colors">
                    <CardContent className="p-4">
                      <div className="flex items-start space-x-3">
                        <div className="bg-blue-100 p-2 rounded-md">
                          <action.icon className="h-5 w-5 text-blue-600" />
                        </div>
                        <div className="flex-1">
                          <h4 className="text-sm font-semibold text-gray-900">
                            {action.title}
                          </h4>
                          <p className="text-xs text-gray-600 mt-1">
                            {action.description}
                          </p>
                        </div>
                      </div>
                    </CardContent>
                  </Card>
                ))}
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Recent Activity */}
        <div>
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center justify-between">
                <div className="flex items-center">
                  <Calendar className="h-5 w-5 mr-2" />
                  Actividad Reciente
                </div>
                <Button variant="ghost" size="sm">
                  Ver todo
                </Button>
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-4">
                {recentActivity.map((activity) => (
                  <div key={activity.id} className="flex items-start space-x-3">
                    <div className={`w-2 h-2 rounded-full mt-2 ${
                      activity.status === 'success' ? 'bg-green-500' :
                      activity.status === 'warning' ? 'bg-amber-500' :
                      activity.status === 'error' ? 'bg-red-500' :
                      'bg-blue-500'
                    }`} />
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium text-gray-900">
                        {activity.title}
                      </p>
                      <p className="text-xs text-gray-500">
                        {activity.description}
                      </p>
                      <p className="text-xs text-gray-400 mt-1">
                        hace {activity.timestamp}
                      </p>
                    </div>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  )
};

export default Dashboard;