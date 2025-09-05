import { useState, useEffect } from "preact/hooks";
import { apiClient, Certificate, DNSProvider, CreateDNSProviderRequest, useApiData } from "../../api";
import { Modal } from "../../components/ui/Modal";
import { Toast } from "../../components/ui/Toast";
import { Breadcrumb } from "../../components/Breadcrumb";
import { usePageTitle } from "../../hooks/usePageTitle";
import { 
  Shield, 
  Plus, 
  Eye, 
  Trash2, 
  Calendar, 
  AlertCircle,
  CheckCircle,
  Lock,
  Globe,
  FileText,
  Upload,
  Server,
  Settings,
  ExternalLink,
  Cloud,
  Home
} from "lucide-preact";

export function Certificates() {  
  usePageTitle("DNS & Certificates");
  
  const [certificates, setCertificates] = useState<Certificate[]>([]);
  const [dnsProviders, setDnsProviders] = useState<DNSProvider[]>([]);
  const [loading, setLoading] = useState(true);
  const [dnsProvidersLoading, setDnsProvidersLoading] = useState(true);
  const [showUploadModal, setShowUploadModal] = useState(false);
  const [showViewModal, setShowViewModal] = useState(false);
  const [showDNSProviderModal, setShowDNSProviderModal] = useState(false);
  const [selectedCertificate, setSelectedCertificate] = useState<Certificate | null>(null);
  const [selectedDNSProvider, setSelectedDNSProvider] = useState<DNSProvider | null>(null);
  const [toast, setToast] = useState<{message: string, type: "success" | "error" | "info"} | null>(null);
  
  // Upload form state
  const [uploadForm, setUploadForm] = useState({
    domain: '',
    type: 'manual' as 'manual' | 'letsencrypt' | 'custom',
    certData: '',
    keyData: '',
    autoRenew: false
  });
  const [uploadLoading, setUploadLoading] = useState(false);
  const [uploadErrors, setUploadErrors] = useState<{[key: string]: string}>({});

  // DNS Provider form state
  const [dnsProviderForm, setDnsProviderForm] = useState({
    name: '',
    type: 'cloudflare' as 'cloudflare' | 'route53' | 'manual',
    label: '',
    email: '',
    apiToken: '',
    config: {}
  });
  const [dnsProviderLoading, setDnsProviderLoading] = useState(false);
  const [dnsProviderErrors, setDnsProviderErrors] = useState<{[key: string]: string}>({});

  useEffect(() => {
    loadCertificates();
    loadDnsProviders();
  }, []);

  const loadCertificates = async () => {
    try {
      setLoading(true);
      const certs = await apiClient.listCertificates();
      setCertificates(certs);
    } catch (error) {
      console.error("Failed to load certificates:", error);
      showToast("Failed to load certificates", "error");
    } finally {
      setLoading(false);
    }
  };

  const loadDnsProviders = async () => {
    try {
      setDnsProvidersLoading(true);
      const providers = await apiClient.listDNSProviders();
      setDnsProviders(providers);
    } catch (error) {
      console.error("Failed to load DNS providers:", error);
      showToast("Failed to load DNS providers", "error");
    } finally {
      setDnsProvidersLoading(false);
    }
  };

  const showToast = (message: string, type: "success" | "error" | "info") => {
    setToast({ message, type });
    setTimeout(() => setToast(null), 5000);
  };

  const validatePEM = (pem: string, type: 'certificate' | 'private_key'): string | null => {
    if (!pem.trim()) {
      return `${type === 'certificate' ? 'Certificate' : 'Private key'} is required`;
    }

    const certStart = '-----BEGIN CERTIFICATE-----';
    const certEnd = '-----END CERTIFICATE-----';
    const keyStart = '-----BEGIN PRIVATE KEY-----';
    const keyEnd = '-----END PRIVATE KEY-----';
    const rsaKeyStart = '-----BEGIN RSA PRIVATE KEY-----';
    const rsaKeyEnd = '-----END RSA PRIVATE KEY-----';

    if (type === 'certificate') {
      if (!pem.includes(certStart) || !pem.includes(certEnd)) {
        return 'Invalid certificate format. Must be a valid PEM certificate.';
      }
    } else {
      const hasPrivateKey = (pem.includes(keyStart) && pem.includes(keyEnd)) ||
                           (pem.includes(rsaKeyStart) && pem.includes(rsaKeyEnd));
      if (!hasPrivateKey) {
        return 'Invalid private key format. Must be a valid PEM private key.';
      }
    }

    return null;
  };

  const validateUploadForm = (): boolean => {
    const errors: {[key: string]: string} = {};

    // Domain validation
    if (!uploadForm.domain.trim()) {
      errors.domain = 'Domain is required';
    } else {
      const domainPattern = /^[a-zA-Z0-9][a-zA-Z0-9-]*[a-zA-Z0-9]*\..*$/;
      if (!domainPattern.test(uploadForm.domain)) {
        errors.domain = 'Please enter a valid domain name';
      }
    }

    // Certificate validation
    const certError = validatePEM(uploadForm.certData, 'certificate');
    if (certError) {
      errors.certData = certError;
    }

    // Private key validation
    const keyError = validatePEM(uploadForm.keyData, 'private_key');
    if (keyError) {
      errors.keyData = keyError;
    }

    setUploadErrors(errors);
    return Object.keys(errors).length === 0;
  };

  const handleUpload = async () => {
    if (!validateUploadForm()) return;

    setUploadLoading(true);
    try {
      await apiClient.uploadCertificate({
        domain: uploadForm.domain.trim(),
        type: uploadForm.type,
        cert_data: uploadForm.certData.trim(),
        key_data: uploadForm.keyData.trim(),
        auto_renew: uploadForm.autoRenew,
      });

      showToast("Certificate uploaded successfully", "success");
      setShowUploadModal(false);
      resetUploadForm();
      await loadCertificates();
    } catch (error) {
      console.error("Failed to upload certificate:", error);
      showToast(
        `Failed to upload certificate: ${error instanceof Error ? error.message : "Unknown error"}`,
        "error"
      );
    } finally {
      setUploadLoading(false);
    }
  };

  const handleDelete = async (certificate: Certificate) => {
    if (!confirm(`Are you sure you want to delete the certificate for ${certificate.domain}?`)) {
      return;
    }

    try {
      await apiClient.deleteCertificate(certificate.id);
      showToast("Certificate deleted successfully", "success");
      await loadCertificates();
    } catch (error) {
      console.error("Failed to delete certificate:", error);
      showToast(
        `Failed to delete certificate: ${error instanceof Error ? error.message : "Unknown error"}`,
        "error"
      );
    }
  };

  const resetUploadForm = () => {
    setUploadForm({
      domain: '',
      type: 'manual',
      certData: '',
      keyData: '',
      autoRenew: false
    });
    setUploadErrors({});
  };

  // DNS Provider functions
  const validateDNSProviderForm = (): boolean => {
    const errors: {[key: string]: string} = {};

    if (!dnsProviderForm.name.trim()) {
      errors.name = 'Name is required';
    }
    if (!dnsProviderForm.label.trim()) {
      errors.label = 'Label is required';
    }
    if (dnsProviderForm.type === 'cloudflare' && !dnsProviderForm.apiToken.trim()) {
      errors.apiToken = 'API Token is required for Cloudflare';
    }

    setDnsProviderErrors(errors);
    return Object.keys(errors).length === 0;
  };

  const handleDNSProviderCreate = async () => {
    if (!validateDNSProviderForm()) return;

    setDnsProviderLoading(true);
    try {
      const request: CreateDNSProviderRequest = {
        name: dnsProviderForm.name.trim(),
        type: dnsProviderForm.type,
        label: dnsProviderForm.label.trim(),
        email: dnsProviderForm.email.trim() || undefined,
        api_token: dnsProviderForm.apiToken.trim() || undefined,
        config: dnsProviderForm.config,
      };

      await apiClient.createDNSProvider(request);
      showToast("DNS Provider created successfully", "success");
      setShowDNSProviderModal(false);
      resetDNSProviderForm();
      loadDnsProviders();
    } catch (error: any) {
      console.error("Failed to create DNS provider:", error);
      showToast(
        `Failed to create DNS provider: ${error.message || "Unknown error"}`,
        "error"
      );
    } finally {
      setDnsProviderLoading(false);
    }
  };

  const handleDNSProviderDelete = async (provider: DNSProvider) => {
    if (!confirm(`Are you sure you want to delete the DNS provider "${provider.label}"?`)) {
      return;
    }

    try {
      await apiClient.deleteDNSProvider(provider.id);
      showToast("DNS Provider deleted successfully", "success");
      loadDnsProviders();
    } catch (error: any) {
      console.error("Failed to delete DNS provider:", error);
      showToast(
        `Failed to delete DNS provider: ${error instanceof Error ? error.message : "Unknown error"}`,
        "error"
      );
    }
  };

  const resetDNSProviderForm = () => {
    setDnsProviderForm({
      name: '',
      type: 'cloudflare',
      label: '',
      email: '',
      apiToken: '',
      config: {}
    });
    setDnsProviderErrors({});
  };

  const formatExpireDate = (expiresAt?: string) => {
    if (!expiresAt) return 'Unknown';
    const date = new Date(expiresAt);
    const now = new Date();
    const diffDays = Math.ceil((date.getTime() - now.getTime()) / (1000 * 60 * 60 * 24));
    
    if (diffDays < 0) {
      return <span class="text-red-600 dark:text-red-400">Expired {Math.abs(diffDays)} days ago</span>;
    } else if (diffDays <= 30) {
      return <span class="text-amber-600 dark:text-amber-400">Expires in {diffDays} days</span>;
    } else {
      return <span class="text-green-600 dark:text-green-400">Expires {date.toLocaleDateString()}</span>;
    }
  };

  const getCertificateTypeIcon = (type: string) => {
    switch (type) {
      case 'letsencrypt':
        return <Lock class="w-4 h-4 text-green-600 dark:text-green-400" />;
      case 'custom':
        return <Shield class="w-4 h-4 text-blue-600 dark:text-blue-400" />;
      default:
        return <FileText class="w-4 h-4 text-gray-600 dark:text-gray-400" />;
    }
  };

  if (loading) {
    return (
      <div class="space-y-6">
        <div class="flex items-center justify-between">
          <h1 class="text-2xl font-semibold text-gray-900 dark:text-white">
            DNS & Certificates
          </h1>
        </div>
        <div class="flex items-center justify-center py-12">
          <div class="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
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
          { label: "DNS & Certificates", href: "/settings/certificates" }
        ]} 
      />

      {/* Header */}
      <div class="flex items-center justify-between">
        <div>
          <h1 class="text-3xl font-bold mb-3">
            <span class="bg-gradient-to-r from-[#9c40ff] via-[#e94057] to-[#8b008b] bg-clip-text text-transparent">
              DNS & Certificates
            </span>
          </h1>
          <p class="text-gray-600 dark:text-gray-300 text-sm mt-1">
            Manage DNS providers and SSL/TLS certificates for your domains
          </p>
        </div>
      </div>

      <div class="space-y-8">
        {/* DNS Providers Section */}
        <div class="space-y-4">
          <div class="flex items-center justify-between">
            <div>
              <h3 class="text-xl font-semibold text-gray-900 dark:text-white mb-2">DNS Providers</h3>
              <p class="text-gray-600 dark:text-gray-300 text-sm">Configure DNS providers for automatic certificate management</p>
            </div>
            <button
              onClick={() => setShowDNSProviderModal(true)}
              class="btn btn-primary flex items-center gap-2"
            >
              <Plus class="h-4 w-4" />
              Add Provider
            </button>
          </div>

        {dnsProvidersLoading ? (
          <div class="flex items-center justify-center py-8">
            <div class="animate-spin rounded-full h-6 w-6 border-b-2 border-blue-600"></div>
          </div>
        ) : dnsProviders.length === 0 ? (
          <div class="text-center py-8">
            <Cloud class="mx-auto h-10 w-10 text-gray-400 mb-3" />
            <h3 class="text-sm font-medium text-gray-900 dark:text-white mb-1">
              No DNS providers configured
            </h3>
            <p class="text-sm text-gray-600 dark:text-gray-400 mb-4">
              Add a DNS provider to enable automatic certificate management.
            </p>
            <button
              onClick={() => setShowDNSProviderModal(true)}
              class="btn btn-primary flex items-center gap-2"
            >
              <Plus class="h-4 w-4 " />
              Add Provider
            </button>
          </div>
        ) : (
          <div class="overflow-hidden">
            <table class="min-w-full divide-y divide-gray-200 dark:divide-gray-700">
              <thead class="bg-gray-50 dark:bg-gray-900">
                <tr>
                  <th class="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                    Provider
                  </th>
                  <th class="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                    Type
                  </th>
                  <th class="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                    Label
                  </th>
                  <th class="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                    Created
                  </th>
                  <th class="px-6 py-3 text-right text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                    Actions
                  </th>
                </tr>
              </thead>
              <tbody class="bg-white dark:bg-gray-800 divide-y divide-gray-200 dark:divide-gray-700">
                {dnsProviders.map((provider) => (
                  <tr key={provider.id} class="hover:bg-gray-50 dark:hover:bg-gray-700/50">
                    <td class="px-6 py-4 whitespace-nowrap">
                      <div class="flex items-center">
                        <Cloud class="w-4 h-4 text-blue-600 dark:text-blue-400 " />
                        <span class="text-sm font-medium text-gray-900 dark:text-white">
                          {provider.name}
                        </span>
                      </div>
                    </td>
                    <td class="px-6 py-4 whitespace-nowrap">
                      <span class="inline-flex items-center px-2 py-1 rounded-full text-xs font-medium bg-blue-100 dark:bg-blue-900/20 text-blue-800 dark:text-blue-300 capitalize">
                        {provider.type}
                      </span>
                    </td>
                    <td class="px-6 py-4 whitespace-nowrap text-sm text-gray-900 dark:text-white">
                      {provider.label}
                    </td>
                    <td class="px-6 py-4 whitespace-nowrap text-sm text-gray-600 dark:text-gray-400">
                      {new Date(provider.created_at).toLocaleDateString()}
                    </td>
                    <td class="px-6 py-4 whitespace-nowrap text-right text-sm font-medium">
                      <button
                        onClick={() => handleDNSProviderDelete(provider)}
                        class="text-red-600 hover:text-red-800 dark:text-red-400 dark:hover:text-red-300"
                        title="Delete DNS provider"
                      >
                        <Trash2 class="w-4 h-4" />
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Certificates Section */}
      <div class="bg-white dark:bg-gray-800 shadow rounded-lg border border-gray-200/50 dark:border-gray-700/50">
        <div class="px-6 py-4 border-b border-gray-200 dark:border-gray-700">
          <div class="flex items-center justify-between">
            <div>
              <h2 class="text-lg font-medium text-gray-900 dark:text-white">SSL/TLS Certificates</h2>
              <p class="text-sm text-gray-600 dark:text-gray-400 mt-1">
                Manage uploaded SSL/TLS certificates for your domains
              </p>
            </div>
            <button
              onClick={() => setShowUploadModal(true)}
              class="btn btn-primary flex items-center gap-2"
            >
              <Plus class="h-4 w-4 " />
              Upload Certificate
            </button>
          </div>
        </div>

        {certificates.length === 0 ? (
          <div class="text-center py-12">
            <Shield class="mx-auto h-12 w-12 text-gray-400 mb-4" />
            <h3 class="text-lg font-medium text-gray-900 dark:text-white mb-2">
              No certificates yet
            </h3>
            <p class="text-gray-600 dark:text-gray-400 mb-6">
              Upload your first SSL/TLS certificate to get started.
            </p>
            <button
              onClick={() => setShowUploadModal(true)}
              class="inline-flex items-center px-4 py-2 border border-transparent text-sm font-medium rounded-md shadow-sm text-white bg-blue-600 hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500"
            >
              <Plus class="h-4 w-4 " />
              Upload Certificate
            </button>
          </div>
        ) : (
          <div class="overflow-hidden">
            <table class="min-w-full divide-y divide-gray-200 dark:divide-gray-700">
              <thead class="bg-gray-50 dark:bg-gray-900">
                <tr>
                  <th class="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                    Domain
                  </th>
                  <th class="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                    Type
                  </th>
                  <th class="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                    Expires
                  </th>
                  <th class="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                    Auto Renew
                  </th>
                  <th class="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                    Status
                  </th>
                  <th class="px-6 py-3 text-right text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                    Actions
                  </th>
                </tr>
              </thead>
              <tbody class="bg-white dark:bg-gray-800 divide-y divide-gray-200 dark:divide-gray-700">
                {certificates.map((certificate) => (
                  <tr key={certificate.id} class="hover:bg-gray-50 dark:hover:bg-gray-700/50">
                    <td class="px-6 py-4 whitespace-nowrap">
                      <div class="flex items-center">
                        <Globe class="w-4 h-4 text-blue-600 dark:text-blue-400 " />
                        <span class="text-sm font-medium text-gray-900 dark:text-white">
                          {certificate.domain}
                        </span>
                      </div>
                    </td>
                    <td class="px-6 py-4 whitespace-nowrap">
                      <div class="flex items-center">
                        {getCertificateTypeIcon(certificate.type)}
                        <span class="ml-2 text-sm text-gray-900 dark:text-white capitalize">
                          {certificate.type}
                        </span>
                      </div>
                    </td>
                    <td class="px-6 py-4 whitespace-nowrap text-sm">
                      {formatExpireDate(certificate.expires_at)}
                    </td>
                    <td class="px-6 py-4 whitespace-nowrap">
                      {certificate.auto_renew ? (
                        <span class="inline-flex items-center px-2 py-1 rounded-full text-xs bg-green-100 dark:bg-green-900/20 text-green-800 dark:text-green-300">
                          <CheckCircle class="w-3 h-3 mr-1" />
                          Enabled
                        </span>
                      ) : (
                        <span class="inline-flex items-center px-2 py-1 rounded-full text-xs bg-gray-100 dark:bg-gray-700 text-gray-800 dark:text-gray-300">
                          Disabled
                        </span>
                      )}
                    </td>
                    <td class="px-6 py-4 whitespace-nowrap">
                      <div class="flex items-center space-x-2">
                        {certificate.has_cert && (
                          <span class="inline-flex items-center px-2 py-1 rounded-full text-xs bg-green-100 dark:bg-green-800 text-green-800 dark:text-green-200">
                            Cert
                          </span>
                        )}
                        {certificate.has_key && (
                          <span class="inline-flex items-center px-2 py-1 rounded-full text-xs bg-blue-100 dark:bg-blue-800 text-blue-800 dark:text-blue-200">
                            Key
                          </span>
                        )}
                      </div>
                    </td>
                    <td class="px-6 py-4 whitespace-nowrap text-right text-sm font-medium">
                      <div class="flex items-center justify-end space-x-2">
                        <button
                          onClick={() => {
                            setSelectedCertificate(certificate);
                            setShowViewModal(true);
                          }}
                          class="text-blue-600 hover:text-blue-800 dark:text-blue-400 dark:hover:text-blue-300"
                          title="View certificate details"
                        >
                          <Eye class="w-4 h-4" />
                        </button>
                        <button
                          onClick={() => handleDelete(certificate)}
                          class="text-red-600 hover:text-red-800 dark:text-red-400 dark:hover:text-red-300"
                          title="Delete certificate"
                        >
                          <Trash2 class="w-4 h-4" />
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Upload Certificate Modal */}
      <Modal
        isOpen={showUploadModal}
        onClose={() => {
          setShowUploadModal(false);
          resetUploadForm();
        }}
        title="Upload Certificate"
        size="lg"
      >
        <div class="space-y-6">
          <p class="text-sm text-gray-600 dark:text-gray-400">
            Upload an SSL/TLS certificate and private key for your domain.
          </p>

          {/* Domain Field */}
          <div>
            <label class="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
              Domain *
            </label>
            <input
              type="text"
              value={uploadForm.domain}
              onInput={(e) => setUploadForm(prev => ({ ...prev, domain: (e.target as HTMLInputElement).value }))}
              placeholder="example.com"
              class={`input ${
                uploadErrors.domain 
                  ? 'border-red-300 dark:border-red-600' 
                  : 'border-gray-300 dark:border-gray-600'
              }`}
            />
            {uploadErrors.domain && (
              <p class="mt-1 text-sm text-red-600 dark:text-red-400">{uploadErrors.domain}</p>
            )}
          </div>

          {/* Type Field */}
          <div>
            <label class="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
              Certificate Type
            </label>
            <select
              value={uploadForm.type}
              onChange={(e) => setUploadForm(prev => ({ ...prev, type: (e.target as HTMLSelectElement).value as any }))}
              class="input"
            >
              <option value="manual">Manual Upload</option>
              <option value="custom">Custom Certificate</option>
              <option value="letsencrypt">Let's Encrypt (for manual upload)</option>
            </select>
          </div>

          {/* Certificate Data */}
          <div>
            <label class="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
              Certificate (PEM Format) *
            </label>
            <textarea
              value={uploadForm.certData}
              onInput={(e) => setUploadForm(prev => ({ ...prev, certData: (e.target as HTMLTextAreaElement).value }))}
              placeholder="-----BEGIN CERTIFICATE-----
MIIFXTCCBEWgAwIBAgISA...
-----END CERTIFICATE-----"
              rows={8}
              class={`input font-mono text-sm ${
                uploadErrors.certData 
                  ? 'border-red-300 dark:border-red-600' 
                  : 'border-gray-300 dark:border-gray-600'
              }`}
            />
            {uploadErrors.certData && (
              <p class="mt-1 text-sm text-red-600 dark:text-red-400">{uploadErrors.certData}</p>
            )}
          </div>

          {/* Private Key Data */}
          <div>
            <label class="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
              Private Key (PEM Format) *
            </label>
            <textarea
              value={uploadForm.keyData}
              onInput={(e) => setUploadForm(prev => ({ ...prev, keyData: (e.target as HTMLTextAreaElement).value }))}
              placeholder="-----BEGIN PRIVATE KEY-----
MIIEvgIBADANBgkqhkiG9w0BAQ...
-----END PRIVATE KEY-----"
              rows={8}
              class={`input font-mono text-sm ${
                uploadErrors.keyData 
                  ? 'border-red-300 dark:border-red-600' 
                  : 'border-gray-300 dark:border-gray-600'
              }`}
            />
            {uploadErrors.keyData && (
              <p class="mt-1 text-sm text-red-600 dark:text-red-400">{uploadErrors.keyData}</p>
            )}
          </div>

          {/* Auto Renew */}
          <div class="flex items-center">
            <input
              id="auto-renew"
              type="checkbox"
              checked={uploadForm.autoRenew}
              onChange={(e) => setUploadForm(prev => ({ ...prev, autoRenew: (e.target as HTMLInputElement).checked }))}
              class="h-4 w-4 text-blue-600 focus:ring-blue-500 border-gray-300 rounded"
            />
            <label htmlFor="auto-renew" class="ml-2 text-sm text-gray-700 dark:text-gray-300">
              Enable auto-renewal (for Let's Encrypt certificates)
            </label>
          </div>

          {/* Action Buttons */}
          <div class="flex justify-end space-x-3 pt-4 border-t border-gray-200 dark:border-gray-700">
            <button
              onClick={() => {
                setShowUploadModal(false);
                resetUploadForm();
              }}
              class="btn btn-secondary"
            >
              Cancel
            </button>
            <button
              onClick={handleUpload}
              disabled={uploadLoading}
              class="btn btn-primary flex items-center gap-2"
            >
              {uploadLoading && (
                <div class="animate-spin rounded-full h-4 w-4 border-b-2 border-white "></div>
              )}
              <Upload class="h-4 w-4 " />
              {uploadLoading ? "Uploading..." : "Upload Certificate"}
            </button>
          </div>
        </div>
      </Modal>

      {/* View Certificate Modal */}
      <Modal
        isOpen={showViewModal}
        onClose={() => {
          setShowViewModal(false);
          setSelectedCertificate(null);
        }}
        title="Certificate Details"
        size="md"
      >
        {selectedCertificate && (
          <div class="space-y-4">
            <div class="grid grid-cols-2 gap-4">
              <div>
                <h4 class="text-sm font-medium text-gray-700 dark:text-gray-300">Domain</h4>
                <p class="text-sm text-gray-900 dark:text-white font-mono">{selectedCertificate.domain}</p>
              </div>
              <div>
                <h4 class="text-sm font-medium text-gray-700 dark:text-gray-300">Type</h4>
                <p class="text-sm text-gray-900 dark:text-white capitalize">{selectedCertificate.type}</p>
              </div>
              <div>
                <h4 class="text-sm font-medium text-gray-700 dark:text-gray-300">Expires</h4>
                <p class="text-sm">{formatExpireDate(selectedCertificate.expires_at)}</p>
              </div>
              <div>
                <h4 class="text-sm font-medium text-gray-700 dark:text-gray-300">Auto Renew</h4>
                <p class="text-sm text-gray-900 dark:text-white">
                  {selectedCertificate.auto_renew ? 'Enabled' : 'Disabled'}
                </p>
              </div>
              <div>
                <h4 class="text-sm font-medium text-gray-700 dark:text-gray-300">Created</h4>
                <p class="text-sm text-gray-900 dark:text-white">
                  {new Date(selectedCertificate.created_at).toLocaleDateString()}
                </p>
              </div>
              <div>
                <h4 class="text-sm font-medium text-gray-700 dark:text-gray-300">Updated</h4>
                <p class="text-sm text-gray-900 dark:text-white">
                  {new Date(selectedCertificate.updated_at).toLocaleDateString()}
                </p>
              </div>
            </div>
            
            <div class="border-t border-gray-200 dark:border-gray-700 pt-4">
              <h4 class="text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">Status</h4>
              <div class="flex space-x-2">
                {selectedCertificate.has_cert && (
                  <span class="inline-flex items-center px-2 py-1 rounded-full text-xs bg-green-100 dark:bg-green-800 text-green-800 dark:text-green-200">
                    <CheckCircle class="w-3 h-3 mr-1" />
                    Certificate Available
                  </span>
                )}
                {selectedCertificate.has_key && (
                  <span class="inline-flex items-center px-2 py-1 rounded-full text-xs bg-blue-100 dark:bg-blue-800 text-blue-800 dark:text-blue-200">
                    <Lock class="w-3 h-3 mr-1" />
                    Private Key Available
                  </span>
                )}
              </div>
            </div>
          </div>
        )}
      </Modal>

      {/* DNS Provider Modal */}
      <Modal
        isOpen={showDNSProviderModal}
        onClose={() => {
          setShowDNSProviderModal(false);
          resetDNSProviderForm();
        }}
        title="Add DNS Provider"
        size="md"
      >
        <div class="space-y-6">
          <p class="text-sm text-gray-600 dark:text-gray-400">
            Add a DNS provider to enable automatic certificate management and validation.
          </p>

          {/* Provider Name */}
          <div>
            <label class="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
              Provider Name *
            </label>
            <input
              type="text"
              value={dnsProviderForm.name}
              onInput={(e) => setDnsProviderForm(prev => ({ ...prev, name: (e.target as HTMLInputElement).value }))}
              placeholder="My Cloudflare Provider"
              class={`input ${
                dnsProviderErrors.name 
                  ? 'border-red-300 dark:border-red-600' 
                  : 'border-gray-300 dark:border-gray-600'
              }`}
            />
            {dnsProviderErrors.name && (
              <p class="mt-1 text-sm text-red-600 dark:text-red-400">{dnsProviderErrors.name}</p>
            )}
          </div>

          {/* Provider Type */}
          <div>
            <label class="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
              Provider Type
            </label>
            <select
              value={dnsProviderForm.type}
              onChange={(e) => setDnsProviderForm(prev => ({ ...prev, type: (e.target as HTMLSelectElement).value as any }))}
              class="input"
            >
              <option value="cloudflare">Cloudflare</option>
              <option value="route53">AWS Route 53</option>
              <option value="manual">Manual DNS</option>
            </select>
          </div>

          {/* Provider Label */}
          <div>
            <label class="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
              Label *
            </label>
            <input
              type="text"
              value={dnsProviderForm.label}
              onInput={(e) => setDnsProviderForm(prev => ({ ...prev, label: (e.target as HTMLInputElement).value }))}
              placeholder="Production Cloudflare"
              class={`input ${
                dnsProviderErrors.label 
                  ? 'border-red-300 dark:border-red-600' 
                  : 'border-gray-300 dark:border-gray-600'
              }`}
            />
            {dnsProviderErrors.label && (
              <p class="mt-1 text-sm text-red-600 dark:text-red-400">{dnsProviderErrors.label}</p>
            )}
          </div>

          {/* Email (for Cloudflare) */}
          {dnsProviderForm.type === 'cloudflare' && (
            <div>
              <label class="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                Email (Optional)
              </label>
              <input
                type="email"
                value={dnsProviderForm.email}
                onInput={(e) => setDnsProviderForm(prev => ({ ...prev, email: (e.target as HTMLInputElement).value }))}
                placeholder="your@email.com"
                class="block w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md shadow-sm placeholder-gray-400 focus:outline-none focus:ring-blue-500 focus:border-blue-500 dark:bg-gray-800 dark:text-white"
              />
              <p class="mt-1 text-xs text-gray-500 dark:text-gray-400">
                Email associated with your Cloudflare account (optional for API tokens)
              </p>
            </div>
          )}

          {/* API Token (for Cloudflare) */}
          {dnsProviderForm.type === 'cloudflare' && (
            <div>
              <label class="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                API Token *
              </label>
              <input
                type="password"
                value={dnsProviderForm.apiToken}
                onInput={(e) => setDnsProviderForm(prev => ({ ...prev, apiToken: (e.target as HTMLInputElement).value }))}
                placeholder="Your Cloudflare API Token"
                class={`input font-mono text-sm ${
                  dnsProviderErrors.apiToken 
                    ? 'border-red-300 dark:border-red-600' 
                    : 'border-gray-300 dark:border-gray-600'
                }`}
              />
              {dnsProviderErrors.apiToken && (
                <p class="mt-1 text-sm text-red-600 dark:text-red-400">{dnsProviderErrors.apiToken}</p>
              )}
              <div class="mt-2 p-3 bg-blue-50 dark:bg-blue-900/20 rounded-md">
                <div class="flex items-start">
                  <div class="flex-shrink-0">
                    <AlertCircle class="h-4 w-4 text-blue-600 dark:text-blue-400 mt-0.5" />
                  </div>
                  <div class="ml-2">
                    <p class="text-sm text-blue-800 dark:text-blue-200 font-medium mb-1">
                      Cloudflare API Token Requirements:
                    </p>
                    <ul class="text-xs text-blue-700 dark:text-blue-300 space-y-1">
                      <li>• Zone:DNS:Edit permissions</li>
                      <li>• Zone Resources: Include all zones you want to manage</li>
                      <li>• Create at <a href="https://dash.cloudflare.com/profile/api-tokens" target="_blank" rel="noopener noreferrer" class="underline hover:text-blue-600 dark:hover:text-blue-200">Cloudflare Dashboard</a></li>
                    </ul>
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* Route53 configuration placeholder */}
          {dnsProviderForm.type === 'route53' && (
            <div class="p-4 bg-amber-50 dark:bg-amber-900/20 rounded-md">
              <div class="flex items-start">
                <div class="flex-shrink-0">
                  <AlertCircle class="h-4 w-4 text-amber-600 dark:text-amber-400 mt-0.5" />
                </div>
                <div class="ml-2">
                  <p class="text-sm text-amber-800 dark:text-amber-200">
                    AWS Route 53 configuration is coming soon. Please use Cloudflare or manual DNS for now.
                  </p>
                </div>
              </div>
            </div>
          )}

          {/* Manual DNS notice */}
          {dnsProviderForm.type === 'manual' && (
            <div class="p-4 bg-gray-50 dark:bg-gray-800 rounded-md">
              <div class="flex items-start">
                <div class="flex-shrink-0">
                  <AlertCircle class="h-4 w-4 text-gray-600 dark:text-gray-400 mt-0.5" />
                </div>
                <div class="ml-2">
                  <p class="text-sm text-gray-700 dark:text-gray-300">
                    Manual DNS requires you to manually create DNS records for certificate validation. 
                    You will be provided with the necessary DNS records during certificate issuance.
                  </p>
                </div>
              </div>
            </div>
          )}

          {/* Action Buttons */}
          <div class="flex justify-end space-x-3 pt-4 border-t border-gray-200 dark:border-gray-700">
            <button
              onClick={() => {
                setShowDNSProviderModal(false);
                resetDNSProviderForm();
              }}
              class="btn btn-secondary"
            >
              Cancel
            </button>
            <button
              onClick={handleDNSProviderCreate}
              disabled={dnsProviderLoading || (dnsProviderForm.type === 'route53')}
              class="btn btn-primary disabled:cursor-not-allowed"
            >
              {dnsProviderLoading && (
                <div class="animate-spin rounded-full h-4 w-4 border-b-2 border-white "></div>
              )}
              <Plus class="h-4 w-4 " />
              {dnsProviderLoading ? "Adding..." : "Add Provider"}
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
    </div>
  );
}