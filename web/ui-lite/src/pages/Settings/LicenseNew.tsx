import { useState, useEffect } from "preact/hooks";
import { Breadcrumb } from "../../components/Breadcrumb";
import { usePageTitle } from "../../hooks/usePageTitle";
import { Modal } from "../../components/ui/Modal";
import { Toast } from "../../components/ui/Toast";
import { apiClient } from "../../api";
import { 
  Home, 
  ScrollText, 
  Upload, 
  Check, 
  X, 
  AlertCircle, 
  Calendar,
  User,
  Building,
  CreditCard,
  FileText
} from "lucide-preact";

interface LicenseInfo {
  is_active: boolean;
  license_key?: string;
  expires_at?: string;
  issued_to?: string;
  organization?: string;
  plan?: string;
  features?: string[];
  error?: string;
}

export function LicenseNew() {
  usePageTitle("License");
  
  const [license, setLicense] = useState<LicenseInfo | null>(null);
  const [loading, setLoading] = useState(true);
  const [showActivateModal, setShowActivateModal] = useState(false);
  const [licenseText, setLicenseText] = useState("");
  const [activating, setActivating] = useState(false);
  const [deactivating, setDeactivating] = useState(false);
  const [toast, setToast] = useState<{message: string, type: "success" | "error" | "info"} | null>(null);

  useEffect(() => {
    loadLicenseStatus();
  }, []);

  const loadLicenseStatus = async () => {
    try {
      setLoading(true);
      const licenseData = await apiClient.getLicense();
      setLicense(licenseData);
    } catch (error) {
      console.error("Failed to load license:", error);
      showToast("Failed to load license information", "error");
    } finally {
      setLoading(false);
    }
  };

  const showToast = (message: string, type: "success" | "error" | "info") => {
    setToast({ message, type });
    setTimeout(() => setToast(null), 5000);
  };

  const handleActivate = async () => {
    if (!licenseText.trim()) {
      showToast("Please enter a license", "error");
      return;
    }

    setActivating(true);
    try {
      await apiClient.activateLicense(licenseText.trim());
      showToast("License activated successfully", "success");
      setShowActivateModal(false);
      setLicenseText("");
      await loadLicenseStatus();
    } catch (error: any) {
      showToast(error.message || "Failed to activate license", "error");
    } finally {
      setActivating(false);
    }
  };

  const handleDeactivate = async () => {
    if (!confirm("Are you sure you want to deactivate your license? This will disable premium features.")) {
      return;
    }

    setDeactivating(true);
    try {
      await apiClient.deactivateLicense();
      showToast("License deactivated successfully", "success");
      await loadLicenseStatus();
    } catch (error: any) {
      showToast(error.message || "Failed to deactivate license", "error");
    } finally {
      setDeactivating(false);
    }
  };

  const handleFileUpload = (event: Event) => {
    const target = event.target as HTMLInputElement;
    const file = target.files?.[0];
    if (!file) return;

    if (file.size > 64 * 1024) {
      showToast("License file too large (max 64KB)", "error");
      return;
    }

    const reader = new FileReader();
    reader.onload = (e) => {
      const content = e.target?.result as string;
      setLicenseText(content);
    };
    reader.onerror = () => {
      showToast("Failed to read license file", "error");
    };
    reader.readAsText(file);
  };

  const formatDate = (dateString?: string) => {
    if (!dateString) return "Unknown";
    return new Date(dateString).toLocaleDateString(undefined, {
      year: 'numeric',
      month: 'long',
      day: 'numeric'
    });
  };

  const isExpiringSoon = (dateString?: string) => {
    if (!dateString) return false;
    const expiryDate = new Date(dateString);
    const now = new Date();
    const daysUntilExpiry = Math.ceil((expiryDate.getTime() - now.getTime()) / (1000 * 60 * 60 * 24));
    return daysUntilExpiry <= 30 && daysUntilExpiry > 0;
  };

  const isExpired = (dateString?: string) => {
    if (!dateString) return false;
    return new Date(dateString) < new Date();
  };

  if (loading) {
    return (
      <div class="min-h-screen">
        <div class="relative z-10 p-3 sm:p-6 max-w-7xl mx-auto space-y-6 fade-in">
          <div class="flex items-center justify-center py-12">
            <div class="animate-spin rounded-full h-8 w-8 border-b-2 border-purple-600"></div>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div class="min-h-screen">
      <div class="relative z-10 p-3 sm:p-6 max-w-7xl mx-auto space-y-6 fade-in">
        {/* Breadcrumb */}
        <Breadcrumb 
          items={[
            { icon: Home, label: "Home", href: "/" },
            { label: "Settings", href: "/settings" },
            { label: "License", href: "/settings/license" }
          ]} 
        />

        {/* Header */}
        <div class="flex items-center justify-between">
          <div>
            <h1 class="text-3xl font-bold mb-3">
              <span class="bg-gradient-to-r from-[#9c40ff] via-[#e94057] to-[#8b008b] bg-clip-text text-transparent">
                License Management
              </span>
            </h1>
            <p class="text-gray-600 dark:text-gray-300 text-sm mt-1">
              View and manage your GLINR Dock license
            </p>
          </div>
          {!license?.is_active && (
            <button
              onClick={() => setShowActivateModal(true)}
              class="btn btn-primary flex items-center gap-2"
            >
              <Upload class="w-4 h-4" />
              Activate License
            </button>
          )}
        </div>

        {/* License Status Card */}
        <div class="bg-white dark:glassmorphism border border-gray-200 dark:border-white/10 rounded-2xl shadow-lg dark:shadow-xl overflow-hidden">
          <div class="p-6">
            <div class="flex items-center justify-between mb-6">
              <div class="flex items-center gap-3">
                <div class={`p-3 rounded-xl ${license?.is_active ? 'bg-green-100 dark:bg-green-900/30' : 'bg-gray-100 dark:bg-gray-800/50'}`}>
                  <ScrollText class={`w-6 h-6 ${license?.is_active ? 'text-green-600 dark:text-green-400' : 'text-gray-600 dark:text-gray-400'}`} />
                </div>
                <div>
                  <h2 class="text-xl font-semibold text-gray-900 dark:text-white">License Status</h2>
                  <div class="flex items-center gap-2 mt-1">
                    {license?.is_active ? (
                      <>
                        <Check class="w-4 h-4 text-green-600 dark:text-green-400" />
                        <span class="text-green-600 dark:text-green-400 font-medium">Active</span>
                        {isExpiringSoon(license.expires_at) && (
                          <span class="text-orange-600 dark:text-orange-400 text-sm">(Expires Soon)</span>
                        )}
                        {isExpired(license.expires_at) && (
                          <span class="text-red-600 dark:text-red-400 text-sm">(Expired)</span>
                        )}
                      </>
                    ) : (
                      <>
                        <X class="w-4 h-4 text-gray-600 dark:text-gray-400" />
                        <span class="text-gray-600 dark:text-gray-400 font-medium">No Active License</span>
                      </>
                    )}
                  </div>
                </div>
              </div>
              {license?.is_active && (
                <button
                  onClick={handleDeactivate}
                  disabled={deactivating}
                  class="btn btn-danger btn-sm flex items-center gap-2"
                >
                  {deactivating ? (
                    <div class="animate-spin rounded-full h-4 w-4 border-b-2 border-white"></div>
                  ) : (
                    <X class="w-4 h-4" />
                  )}
                  Deactivate
                </button>
              )}
            </div>

            {license?.is_active ? (
              <div class="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
                <div class="p-4 bg-gray-50 dark:bg-gray-800/50 rounded-xl">
                  <div class="flex items-center gap-2 mb-2">
                    <User class="w-4 h-4 text-gray-600 dark:text-gray-400" />
                    <span class="text-sm font-medium text-gray-700 dark:text-gray-300">Licensed To</span>
                  </div>
                  <p class="text-gray-900 dark:text-white font-medium">{license.issued_to || "Unknown"}</p>
                </div>

                <div class="p-4 bg-gray-50 dark:bg-gray-800/50 rounded-xl">
                  <div class="flex items-center gap-2 mb-2">
                    <Building class="w-4 h-4 text-gray-600 dark:text-gray-400" />
                    <span class="text-sm font-medium text-gray-700 dark:text-gray-300">Organization</span>
                  </div>
                  <p class="text-gray-900 dark:text-white font-medium">{license.organization || "Individual"}</p>
                </div>

                <div class="p-4 bg-gray-50 dark:bg-gray-800/50 rounded-xl">
                  <div class="flex items-center gap-2 mb-2">
                    <CreditCard class="w-4 h-4 text-gray-600 dark:text-gray-400" />
                    <span class="text-sm font-medium text-gray-700 dark:text-gray-300">Plan</span>
                  </div>
                  <p class="text-gray-900 dark:text-white font-medium">{license.plan || "Standard"}</p>
                </div>

                <div class="p-4 bg-gray-50 dark:bg-gray-800/50 rounded-xl">
                  <div class="flex items-center gap-2 mb-2">
                    <Calendar class="w-4 h-4 text-gray-600 dark:text-gray-400" />
                    <span class="text-sm font-medium text-gray-700 dark:text-gray-300">Expires</span>
                  </div>
                  <p class={`font-medium ${
                    isExpired(license.expires_at) ? 'text-red-600 dark:text-red-400' :
                    isExpiringSoon(license.expires_at) ? 'text-orange-600 dark:text-orange-400' :
                    'text-gray-900 dark:text-white'
                  }`}>
                    {formatDate(license.expires_at)}
                  </p>
                </div>
              </div>
            ) : (
              <div class="text-center py-8">
                <AlertCircle class="w-12 h-12 text-gray-400 mx-auto mb-4" />
                <h3 class="text-lg font-medium text-gray-900 dark:text-white mb-2">
                  No License Activated
                </h3>
                <p class="text-gray-600 dark:text-gray-400 mb-6">
                  Activate a license to unlock premium features and extended functionality.
                </p>
                <button
                  onClick={() => setShowActivateModal(true)}
                  class="btn btn-primary flex items-center gap-2 mx-auto"
                >
                  <Upload class="w-4 h-4" />
                  Activate License
                </button>
              </div>
            )}

            {license?.features && license.features.length > 0 && (
              <div class="mt-6 pt-6 border-t border-gray-200 dark:border-gray-700">
                <h3 class="text-lg font-medium text-gray-900 dark:text-white mb-4">Enabled Features</h3>
                <div class="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-2">
                  {license.features.map((feature) => (
                    <div key={feature} class="flex items-center gap-2 p-2 bg-green-50 dark:bg-green-900/20 rounded-lg">
                      <Check class="w-4 h-4 text-green-600 dark:text-green-400" />
                      <span class="text-sm text-green-800 dark:text-green-300 capitalize">
                        {feature.replace(/_/g, ' ')}
                      </span>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        </div>

        {/* License Activation Modal */}
        <Modal
          isOpen={showActivateModal}
          onClose={() => {
            setShowActivateModal(false);
            setLicenseText("");
          }}
          title="Activate License"
          size="md"
        >
          <div class="space-y-6">
            <div class="text-center">
              <div class="w-12 h-12 bg-gradient-to-br from-[#9c40ff]/20 to-[#8b008b]/20 rounded-lg flex items-center justify-center mx-auto mb-4">
                <FileText class="w-6 h-6 text-[#9c40ff]" />
              </div>
              <h3 class="text-lg font-medium text-gray-900 dark:text-white mb-2">
                License Activation
              </h3>
              <p class="text-sm text-gray-600 dark:text-gray-400">
                Enter your license key or upload a license file to activate premium features.
              </p>
            </div>

            <div>
              <label class="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                License Key or Text
              </label>
              <textarea
                value={licenseText}
                onInput={(e) => setLicenseText((e.target as HTMLTextAreaElement).value)}
                placeholder="Enter your license key or paste license content here..."
                rows={6}
                class="input font-mono text-sm"
              />
            </div>

            <div class="text-center">
              <span class="text-sm text-gray-500 dark:text-gray-400 mb-2 block">or</span>
              <label class="btn btn-secondary cursor-pointer">
                <Upload class="w-4 h-4 mr-2" />
                Upload License File
                <input
                  type="file"
                  accept=".txt,.lic,.license"
                  onChange={handleFileUpload}
                  class="hidden"
                />
              </label>
            </div>

            <div class="flex justify-end space-x-3 pt-4 border-t border-gray-200 dark:border-gray-700">
              <button
                onClick={() => {
                  setShowActivateModal(false);
                  setLicenseText("");
                }}
                class="btn btn-secondary"
              >
                Cancel
              </button>
              <button
                onClick={handleActivate}
                disabled={activating || !licenseText.trim()}
                class="btn btn-primary flex items-center gap-2"
              >
                {activating && (
                  <div class="animate-spin rounded-full h-4 w-4 border-b-2 border-white"></div>
                )}
                <Check class="w-4 h-4" />
                {activating ? "Activating..." : "Activate License"}
              </button>
            </div>
          </div>
        </Modal>

        {/* Toast */}
        {toast && (
          <Toast
            message={toast.message}
            type={toast.type}
            isVisible={true}
            onClose={() => setToast(null)}
          />
        )}
      </div>
    </div>
  );
}