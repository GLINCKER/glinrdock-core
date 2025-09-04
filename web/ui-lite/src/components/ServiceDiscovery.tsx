import { useState, useEffect } from "preact/hooks";
import { apiClient, DiscoveredService, DiscoveryResponse, Project, AdoptContainerRequest, CleanupContainerRequest } from "../api";
import { ServiceIcon } from "./ServiceIcons";
import { StatusBadge } from "./ui/ServiceBadge";
import { Modal } from "./ui/Modal";
import { Toast } from "./ui/Toast";
import { 
  Search, 
  AlertTriangle, 
  Container, 
  Plus,
  RefreshCw,
  Info,
  CheckCircle,
  XCircle,
  Trash2,
  AlertCircle
} from "lucide-preact";

interface ServiceDiscoveryProps {
  projects: Project[];
  onServiceAdopted?: () => void;
}

export function ServiceDiscovery({ projects, onServiceAdopted }: ServiceDiscoveryProps) {
  const [discoveredServices, setDiscoveredServices] = useState<DiscoveredService[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [showAll, setShowAll] = useState(false);
  const [showModal, setShowModal] = useState(false);
  const [selectedService, setSelectedService] = useState<DiscoveredService | null>(null);
  const [adoptionLoading, setAdoptionLoading] = useState(false);
  const [cleanupLoading, setCleanupLoading] = useState(false);
  const [adoptionForm, setAdoptionForm] = useState({
    projectId: '',
    serviceName: ''
  });
  const [showCleanupModal, setShowCleanupModal] = useState(false);
  const [cleanupForce, setCleanupForce] = useState(false);
  const [toast, setToast] = useState<{
    message: string;
    type: "success" | "error" | "info";
    isVisible: boolean;
  }>({ message: "", type: "info", isVisible: false });

  const showToast = (message: string, type: "success" | "error" | "info") => {
    setToast({ message, type, isVisible: true });
  };

  const discoverServices = async () => {
    setLoading(true);
    setError(null);
    try {
      const response = await apiClient.discoverServices(showAll);
      setDiscoveredServices(response.discovered_services || []);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to discover services');
      console.error('Discovery failed:', err);
    } finally {
      setLoading(false);
    }
  };

  // Auto-discover on component mount
  useEffect(() => {
    discoverServices();
  }, [showAll]);

  const handleServiceAction = (service: DiscoveredService, action: 'adopt' | 'cleanup' | 'inspect') => {
    setSelectedService(service);
    
    if (action === 'adopt') {
      // Pre-fill the form with suggested values
      setAdoptionForm({
        projectId: '',
        serviceName: service.container_name.replace('/glinr_', '').replace(/^[0-9]+_/, '') || 'imported-service'
      });
      setShowModal(true);
    } else if (action === 'cleanup') {
      // Check if container is running for force cleanup warning
      setCleanupForce(service.status.includes('Up'));
      setShowCleanupModal(true);
    } else if (action === 'inspect') {
      showToast(`Container ID: ${service.container_id}`, 'info');
    }
  };

  const handleAdoptContainer = async () => {
    if (!selectedService || !adoptionForm.projectId || !adoptionForm.serviceName) {
      showToast('Please fill in all required fields', 'error');
      return;
    }

    setAdoptionLoading(true);
    try {
      const request: AdoptContainerRequest = {
        container_id: selectedService.container_id,
        project_id: parseInt(adoptionForm.projectId),
        service_name: adoptionForm.serviceName
      };

      const response = await apiClient.adoptContainer(request);
      showToast(response.message, 'success');
      setShowModal(false);
      setSelectedService(null);
      setAdoptionForm({ projectId: '', serviceName: '' });
      
      // Refresh discovery and notify parent
      await discoverServices();
      onServiceAdopted?.();
      
    } catch (error) {
      console.error('Adoption failed:', error);
      showToast(error instanceof Error ? error.message : 'Failed to adopt container', 'error');
    } finally {
      setAdoptionLoading(false);
    }
  };

  const handleCleanupContainer = async () => {
    if (!selectedService) return;

    setCleanupLoading(true);
    try {
      const request: CleanupContainerRequest = {
        container_id: selectedService.container_id,
        force: cleanupForce
      };

      const response = await apiClient.cleanupContainer(request);
      showToast(response.message, 'success');
      setShowCleanupModal(false);
      setSelectedService(null);
      setCleanupForce(false);
      
      // Refresh discovery
      await discoverServices();
      
    } catch (error) {
      console.error('Cleanup failed:', error);
      showToast(error instanceof Error ? error.message : 'Failed to cleanup container', 'error');
    } finally {
      setCleanupLoading(false);
    }
  };

  const getStatusColor = (service: DiscoveredService) => {
    if (service.is_orphaned) {
      return service.status.includes('Up') ? 'text-yellow-600' : 'text-red-600';
    }
    return service.status.includes('Up') ? 'text-green-600' : 'text-gray-600';
  };

  const getStatusIcon = (service: DiscoveredService) => {
    if (service.is_orphaned) {
      return <AlertTriangle className="w-4 h-4 text-yellow-500" />;
    }
    return service.status.includes('Up') ? 
      <CheckCircle className="w-4 h-4 text-green-500" /> : 
      <XCircle className="w-4 h-4 text-gray-500" />;
  };

  return (
    <div className="bg-white dark:bg-gray-800 rounded-xl shadow-lg border border-gray-200/50 dark:border-gray-700/50">
      {/* Header */}
      <div className="p-6 border-b border-gray-200 dark:border-gray-700">
        <div className="flex items-center justify-between">
          <div className="flex items-center space-x-3">
            <Search className="w-5 h-5 text-blue-600 dark:text-blue-400" />
            <h3 className="text-lg font-semibold text-gray-900 dark:text-white">
              Service Discovery
            </h3>
            <div className="flex items-center space-x-2 text-sm text-gray-500">
              <Container className="w-4 h-4" />
              <span>{discoveredServices.length} containers found</span>
            </div>
          </div>
          
          <div className="flex items-center space-x-3">
            {/* Toggle for showing all containers */}
            <div className="flex items-center space-x-3">
              <span className="text-sm text-gray-700 dark:text-gray-300">Show all containers</span>
              <button
                type="button"
                className={`relative inline-flex h-5 w-9 flex-shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors duration-200 ease-in-out focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2 ${
                  showAll ? 'bg-blue-600' : 'bg-gray-200 dark:bg-gray-600'
                }`}
                role="switch"
                aria-checked={showAll}
                onClick={() => setShowAll(!showAll)}
              >
                <span className="sr-only">Show all containers</span>
                <span
                  aria-hidden="true"
                  className={`pointer-events-none inline-block h-4 w-4 transform rounded-full bg-white shadow-lg ring-0 transition duration-200 ease-in-out ${
                    showAll ? 'translate-x-4' : 'translate-x-0'
                  }`}
                />
              </button>
            </div>
            
            <button
              onClick={discoverServices}
              disabled={loading}
              className="inline-flex items-center px-3 py-2 text-sm bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-300 rounded-lg hover:bg-blue-200 dark:hover:bg-blue-800/50 transition-colors disabled:opacity-50"
            >
              <RefreshCw className={`w-4 h-4 mr-2 ${loading ? 'animate-spin' : ''}`} />
              {loading ? 'Discovering...' : 'Refresh'}
            </button>
          </div>
        </div>
      </div>

      {/* Content */}
      <div className="p-6">
        {error && (
          <div className="mb-6 p-4 bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-700 rounded-lg">
            <div className="flex items-center text-red-800 dark:text-red-200">
              <AlertTriangle className="w-5 h-5 mr-2" />
              <span className="font-medium">Discovery Failed</span>
            </div>
            <p className="mt-1 text-sm text-red-700 dark:text-red-300">{error}</p>
          </div>
        )}

        {discoveredServices.length === 0 && !loading ? (
          <div className="text-center py-12">
            <Container className="w-12 h-12 text-gray-400 mx-auto mb-4" />
            <h3 className="text-lg font-medium text-gray-900 dark:text-white mb-2">
              {showAll ? 'No containers found' : 'No orphaned containers found'}
            </h3>
            <p className="text-gray-600 dark:text-gray-400">
              {showAll 
                ? 'No GLINR-managed containers are running on this system.'
                : 'All containers are properly tracked in the database.'}
            </p>
          </div>
        ) : (
          <div className="space-y-4">
            {discoveredServices.map((service) => (
              <div
                key={service.container_id}
                className={`flex items-center justify-between p-4 border rounded-lg transition-colors ${
                  service.is_orphaned
                    ? 'border-yellow-200 dark:border-yellow-700 bg-yellow-50/50 dark:bg-yellow-900/10'
                    : 'border-gray-200 dark:border-gray-700 bg-gray-50/50 dark:bg-gray-700/20'
                }`}
              >
                <div className="flex items-center space-x-4">
                  <ServiceIcon 
                    imageName={service.image} 
                    className="w-12 h-12 shadow-lg" 
                    size={48} 
                  />
                  
                  <div>
                    <div className="flex items-center space-x-2">
                      <h4 className="font-medium text-gray-900 dark:text-white">
                        {service.container_name.replace('/glinr_', '').replace(/^[0-9]+_/, '')}
                      </h4>
                      {getStatusIcon(service)}
                      <span className={`text-sm ${getStatusColor(service)}`}>
                        {service.status}
                      </span>
                    </div>
                    
                    <div className="flex items-center space-x-3 mt-1 text-sm text-gray-600 dark:text-gray-400">
                      <span className="font-mono">{service.image}</span>
                      <span>•</span>
                      <span>{new Date(service.created).toLocaleDateString()}</span>
                      {service.project_id && (
                        <>
                          <span>•</span>
                          <span>Project {service.project_id}</span>
                        </>
                      )}
                    </div>
                    
                    {service.is_orphaned && service.orphan_reason && (
                      <div className="mt-2 flex items-center space-x-2 text-sm text-yellow-700 dark:text-yellow-300">
                        <Info className="w-4 h-4" />
                        <span>{service.orphan_reason}</span>
                      </div>
                    )}
                  </div>
                </div>

                <div className="flex items-center space-x-2">
                  {service.is_orphaned && (
                    <button
                      onClick={() => handleServiceAction(service, 'adopt')}
                      className="inline-flex items-center px-3 py-2 text-sm bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-300 rounded-lg hover:bg-green-200 dark:hover:bg-green-800/50 transition-colors"
                    >
                      <Plus className="w-4 h-4 mr-1" />
                      Adopt
                    </button>
                  )}
                  
                  <button
                    onClick={() => handleServiceAction(service, 'cleanup')}
                    className="inline-flex items-center px-3 py-2 text-sm bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-300 rounded-lg hover:bg-red-200 dark:hover:bg-red-800/50 transition-colors"
                  >
                    <Trash2 className="w-4 h-4 mr-1" />
                    Cleanup
                  </button>
                  
                  <button
                    onClick={() => handleServiceAction(service, 'inspect')}
                    className="inline-flex items-center px-3 py-2 text-sm bg-gray-100 text-gray-700 dark:bg-gray-700 dark:text-gray-300 rounded-lg hover:bg-gray-200 dark:hover:bg-gray-600 transition-colors"
                  >
                    <Info className="w-4 h-4 mr-1" />
                    Details
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Adoption Modal */}
      <Modal
        isOpen={showModal}
        onClose={() => setShowModal(false)}
        title="Adopt Container"
        size="md"
      >
        {selectedService && (
          <div className="space-y-6">
            <div className="bg-blue-50 dark:bg-blue-900/20 p-4 rounded-lg border border-blue-200 dark:border-blue-700">
              <div className="flex items-start space-x-3">
                <Info className="w-5 h-5 text-blue-600 dark:text-blue-400 mt-0.5" />
                <div>
                  <h4 className="font-medium text-blue-900 dark:text-blue-100 mb-2">
                    Container Adoption
                  </h4>
                  <p className="text-sm text-blue-800 dark:text-blue-200">
                    This will create a new service entry in the database for this existing container. 
                    The container will be managed by GLINR going forward.
                  </p>
                </div>
              </div>
            </div>

            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                  Container Details
                </label>
                <div className="bg-gray-50 dark:bg-gray-700 p-3 rounded-lg space-y-2 text-sm">
                  <div><strong>Name:</strong> {selectedService.container_name}</div>
                  <div><strong>Image:</strong> {selectedService.image}</div>
                  <div><strong>Status:</strong> {selectedService.status}</div>
                  <div><strong>Created:</strong> {new Date(selectedService.created).toLocaleString()}</div>
                </div>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                  Assign to Project
                </label>
                <select 
                  value={adoptionForm.projectId}
                  onChange={(e) => setAdoptionForm(prev => ({ ...prev, projectId: (e.target as HTMLSelectElement).value }))}
                  className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 dark:bg-gray-700 dark:text-white"
                >
                  <option value="">Select a project...</option>
                  {projects.map((project) => (
                    <option key={project.id} value={project.id}>
                      {project.name}
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                  Service Name
                </label>
                <input
                  type="text"
                  value={adoptionForm.serviceName}
                  onChange={(e) => setAdoptionForm(prev => ({ ...prev, serviceName: (e.target as HTMLInputElement).value }))}
                  placeholder="Enter service name..."
                  className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 dark:bg-gray-700 dark:text-white"
                />
              </div>
            </div>

            <div className="flex justify-end space-x-3 pt-4 border-t border-gray-200 dark:border-gray-700">
              <button
                onClick={() => setShowModal(false)}
                className="px-4 py-2 text-gray-700 dark:text-gray-300 bg-gray-100 dark:bg-gray-600 rounded-lg hover:bg-gray-200 dark:hover:bg-gray-500 transition-colors"
              >
                Cancel
              </button>
              <button
                onClick={handleAdoptContainer}
                disabled={adoptionLoading}
                className="inline-flex items-center px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
              >
                {adoptionLoading ? (
                  <>
                    <RefreshCw className="w-4 h-4 mr-2 animate-spin" />
                    Adopting...
                  </>
                ) : (
                  <>
                    <Plus className="w-4 h-4 mr-2" />
                    Adopt Container
                  </>
                )}
              </button>
            </div>
          </div>
        )}
      </Modal>

      {/* Cleanup Modal */}
      <Modal
        isOpen={showCleanupModal}
        onClose={() => setShowCleanupModal(false)}
        title="Cleanup Container"
        size="md"
      >
        {selectedService && (
          <div className="space-y-6">
            <div className="bg-red-50 dark:bg-red-900/20 p-4 rounded-lg border border-red-200 dark:border-red-700">
              <div className="flex items-start space-x-3">
                <AlertTriangle className="w-5 h-5 text-red-600 dark:text-red-400 mt-0.5" />
                <div>
                  <h4 className="font-medium text-red-900 dark:text-red-100 mb-2">
                    Container Cleanup
                  </h4>
                  <p className="text-sm text-red-800 dark:text-red-200">
                    This will permanently remove the container and its data. 
                    {selectedService.status.includes('Up') && ' The container is currently running and will be forcefully stopped.'}
                  </p>
                </div>
              </div>
            </div>

            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                  Container Details
                </label>
                <div className="bg-gray-50 dark:bg-gray-700 p-3 rounded-lg space-y-2 text-sm">
                  <div><strong>Name:</strong> {selectedService.container_name}</div>
                  <div><strong>Image:</strong> {selectedService.image}</div>
                  <div><strong>Status:</strong> {selectedService.status}</div>
                  <div><strong>Created:</strong> {new Date(selectedService.created).toLocaleString()}</div>
                </div>
              </div>

              {selectedService.status.includes('Up') && (
                <div className="flex items-center space-x-2">
                  <input
                    type="checkbox"
                    id="forceCleanup"
                    checked={cleanupForce}
                    onChange={(e) => setCleanupForce((e.target as HTMLInputElement).checked)}
                    className="rounded border-gray-300 text-red-600 focus:ring-red-500"
                  />
                  <label htmlFor="forceCleanup" className="text-sm text-gray-700 dark:text-gray-300">
                    Force stop running container
                  </label>
                </div>
              )}
            </div>

            <div className="flex justify-end space-x-3 pt-4 border-t border-gray-200 dark:border-gray-700">
              <button
                onClick={() => setShowCleanupModal(false)}
                className="px-4 py-2 text-gray-700 dark:text-gray-300 bg-gray-100 dark:bg-gray-600 rounded-lg hover:bg-gray-200 dark:hover:bg-gray-500 transition-colors"
              >
                Cancel
              </button>
              <button
                onClick={handleCleanupContainer}
                disabled={cleanupLoading}
                className="inline-flex items-center px-4 py-2 bg-red-600 text-white rounded-lg hover:bg-red-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
              >
                {cleanupLoading ? (
                  <>
                    <RefreshCw className="w-4 h-4 mr-2 animate-spin" />
                    Cleaning up...
                  </>
                ) : (
                  <>
                    <Trash2 className="w-4 h-4 mr-2" />
                    Delete Container
                  </>
                )}
              </button>
            </div>
          </div>
        )}
      </Modal>

      {/* Toast Notifications */}
      <Toast
        message={toast.message}
        type={toast.type}
        isVisible={toast.isVisible}
        onClose={() => setToast((prev) => ({ ...prev, isVisible: false }))}
      />
    </div>
  );
}