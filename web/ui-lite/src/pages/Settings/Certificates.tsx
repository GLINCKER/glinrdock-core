import { useState, useEffect } from "preact/hooks";
import { apiClient, Certificate, useApiData } from "../../api";
import { Modal } from "../../components/ui/Modal";
import { Toast } from "../../components/ui/Toast";
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
  Upload
} from "lucide-preact";

export function Certificates() {
  const [certificates, setCertificates] = useState<Certificate[]>([]);
  const [loading, setLoading] = useState(true);
  const [showUploadModal, setShowUploadModal] = useState(false);
  const [showViewModal, setShowViewModal] = useState(false);
  const [selectedCertificate, setSelectedCertificate] = useState<Certificate | null>(null);
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

  useEffect(() => {
    loadCertificates();
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
            SSL/TLS Certificates
          </h1>
        </div>
        <div class="flex items-center justify-center py-12">
          <div class="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
        </div>
      </div>
    );
  }

  return (
    <div class="space-y-6">
      {/* Header */}
      <div class="flex items-center justify-between">
        <div>
          <h1 class="text-2xl font-semibold text-gray-900 dark:text-white">
            SSL/TLS Certificates
          </h1>
          <p class="text-sm text-gray-600 dark:text-gray-400 mt-1">
            Manage SSL/TLS certificates for your domains
          </p>
        </div>

        <button
          onClick={() => setShowUploadModal(true)}
          class="inline-flex items-center px-4 py-2 border border-transparent text-sm font-medium rounded-md shadow-sm text-white bg-blue-600 hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500"
        >
          <Plus class="h-4 w-4 mr-2" />
          Upload Certificate
        </button>
      </div>

      {/* Certificates Table */}
      <div class="bg-white dark:bg-gray-800 shadow rounded-lg border border-gray-200/50 dark:border-gray-700/50">
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
              <Plus class="h-4 w-4 mr-2" />
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
                        <Globe class="w-4 h-4 text-blue-600 dark:text-blue-400 mr-2" />
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
        size="large"
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
              class={`block w-full px-3 py-2 border rounded-md shadow-sm placeholder-gray-400 focus:outline-none focus:ring-blue-500 focus:border-blue-500 dark:bg-gray-800 dark:text-white ${
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
              class="block w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md shadow-sm focus:outline-none focus:ring-blue-500 focus:border-blue-500 dark:bg-gray-800 dark:text-white"
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
              class={`block w-full px-3 py-2 border rounded-md shadow-sm placeholder-gray-400 focus:outline-none focus:ring-blue-500 focus:border-blue-500 dark:bg-gray-800 dark:text-white font-mono text-sm ${
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
              class={`block w-full px-3 py-2 border rounded-md shadow-sm placeholder-gray-400 focus:outline-none focus:ring-blue-500 focus:border-blue-500 dark:bg-gray-800 dark:text-white font-mono text-sm ${
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
              class="px-4 py-2 text-sm font-medium text-gray-700 dark:text-gray-300 border border-gray-300 dark:border-gray-600 rounded-md hover:bg-gray-50 dark:hover:bg-gray-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500"
            >
              Cancel
            </button>
            <button
              onClick={handleUpload}
              disabled={uploadLoading}
              class="inline-flex items-center px-4 py-2 border border-transparent text-sm font-medium rounded-md shadow-sm text-white bg-blue-600 hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500 disabled:opacity-50"
            >
              {uploadLoading && (
                <div class="animate-spin rounded-full h-4 w-4 border-b-2 border-white mr-2"></div>
              )}
              <Upload class="h-4 w-4 mr-2" />
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
        size="medium"
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

      {/* Toast */}
      {toast && (
        <Toast
          message={toast.message}
          type={toast.type}
          onClose={() => setToast(null)}
        />
      )}
    </div>
  );
}