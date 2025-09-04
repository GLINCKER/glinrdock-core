export interface ServiceTemplate {
  id: string
  name: string
  displayName: string
  description: string
  image: string
  category: 'database' | 'cache' | 'web' | 'message' | 'monitoring' | 'development' | 'storage' | 'streaming'
  iconKey: string
  defaultPort: number
  additionalPorts?: number[]
  defaultEnv?: Record<string, string>
  documentation?: string
  tags: string[]
  popular: boolean
  version?: string
  memoryRequirement?: string
  complexity: 'beginner' | 'intermediate' | 'advanced'
}

export const serviceTemplates: ServiceTemplate[] = [
  // === DATABASES ===
  {
    id: 'postgres',
    name: 'postgres',
    displayName: 'PostgreSQL',
    description: 'Advanced open source relational database with excellent performance and reliability',
    image: 'postgres:15-alpine',
    category: 'database',
    iconKey: 'postgres',
    defaultPort: 8091,
    defaultEnv: {
      'POSTGRES_DB': 'app',
      'POSTGRES_USER': 'admin',
      'POSTGRES_PASSWORD': 'password123'
    },
    documentation: 'https://www.postgresql.org/docs/',
    tags: ['database', 'sql', 'relational', 'acid'],
    popular: true,
    version: '15',
    memoryRequirement: '256MB',
    complexity: 'beginner'
  },
  {
    id: 'mysql',
    name: 'mysql',
    displayName: 'MySQL',
    description: 'World\'s most popular open source relational database',
    image: 'mysql:8.0',
    category: 'database',
    iconKey: 'mysql',
    defaultPort: 8099,
    defaultEnv: {
      'MYSQL_DATABASE': 'app',
      'MYSQL_USER': 'admin',
      'MYSQL_PASSWORD': 'password123',
      'MYSQL_ROOT_PASSWORD': 'rootpassword123'
    },
    documentation: 'https://dev.mysql.com/doc/',
    tags: ['database', 'sql', 'relational', 'mysql'],
    popular: true,
    version: '8.0',
    memoryRequirement: '256MB',
    complexity: 'beginner'
  },
  {
    id: 'mongodb',
    name: 'mongodb',
    displayName: 'MongoDB',
    description: 'Document-based NoSQL database for modern applications',
    image: 'mongo:7',
    category: 'database',
    iconKey: 'mongodb',
    defaultPort: 8092,
    defaultEnv: {
      'MONGO_INITDB_DATABASE': 'app',
      'MONGO_INITDB_ROOT_USERNAME': 'admin',
      'MONGO_INITDB_ROOT_PASSWORD': 'password123'
    },
    documentation: 'https://docs.mongodb.com/',
    tags: ['database', 'nosql', 'document', 'json'],
    popular: true,
    version: '7.0',
    memoryRequirement: '512MB',
    complexity: 'intermediate'
  },
  {
    id: 'elasticsearch',
    name: 'elasticsearch',
    displayName: 'Elasticsearch',
    description: 'Distributed search and analytics engine built on Apache Lucene',
    image: 'elasticsearch:8.11.0',
    category: 'database',
    iconKey: 'elasticsearch',
    defaultPort: 8096,
    defaultEnv: {
      'discovery.type': 'single-node',
      'xpack.security.enabled': 'false',
      'ES_JAVA_OPTS': '-Xms512m -Xmx512m'
    },
    documentation: 'https://www.elastic.co/guide/',
    tags: ['search', 'analytics', 'logs', 'elasticsearch'],
    popular: true,
    version: '8.11',
    memoryRequirement: '1GB',
    complexity: 'advanced'
  },

  // === CACHE & MEMORY STORES ===
  {
    id: 'redis',
    name: 'redis',
    displayName: 'Redis',
    description: 'In-memory data structure store - cache, database, and message broker',
    image: 'redis:7-alpine',
    category: 'cache',
    iconKey: 'redis',
    defaultPort: 8090,
    defaultEnv: {},
    documentation: 'https://redis.io/documentation',
    tags: ['cache', 'memory', 'nosql', 'key-value'],
    popular: true,
    version: '7.0',
    memoryRequirement: '128MB',
    complexity: 'beginner'
  },

  // === MESSAGE QUEUES & STREAMING ===
  {
    id: 'rabbitmq',
    name: 'rabbitmq',
    displayName: 'RabbitMQ',
    description: 'Reliable message broker supporting multiple messaging protocols',
    image: 'rabbitmq:3-management-alpine',
    category: 'message',
    iconKey: 'rabbitmq',
    defaultPort: 8094,
    additionalPorts: [8095], // Management UI
    defaultEnv: {
      'RABBITMQ_DEFAULT_USER': 'admin',
      'RABBITMQ_DEFAULT_PASS': 'password123'
    },
    documentation: 'https://www.rabbitmq.com/documentation.html',
    tags: ['messaging', 'queue', 'amqp', 'broker'],
    popular: true,
    version: '3.12',
    memoryRequirement: '256MB',
    complexity: 'intermediate'
  },
  {
    id: 'kafka',
    name: 'kafka',
    displayName: 'Apache Kafka',
    description: 'Distributed event streaming platform for high-throughput data pipelines',
    image: 'confluentinc/cp-kafka:latest',
    category: 'streaming',
    iconKey: 'kafka',
    defaultPort: 8101,
    defaultEnv: {
      'KAFKA_BROKER_ID': '1',
      'KAFKA_ZOOKEEPER_CONNECT': 'zookeeper:2181',
      'KAFKA_ADVERTISED_LISTENERS': 'PLAINTEXT://localhost:8101',
      'KAFKA_AUTO_CREATE_TOPICS_ENABLE': 'true'
    },
    documentation: 'https://kafka.apache.org/documentation/',
    tags: ['streaming', 'events', 'kafka', 'big-data'],
    popular: false,
    version: '7.4',
    memoryRequirement: '1GB',
    complexity: 'advanced'
  },

  // === WEB SERVERS ===
  {
    id: 'nginx',
    name: 'nginx-web',
    displayName: 'Nginx',
    description: 'High-performance web server, reverse proxy, and load balancer',
    image: 'nginx:alpine',
    category: 'web',
    iconKey: 'nginx',
    defaultPort: 8093,
    defaultEnv: {},
    documentation: 'https://nginx.org/en/docs/',
    tags: ['web', 'proxy', 'static', 'load-balancer'],
    popular: true,
    version: '1.25',
    memoryRequirement: '64MB',
    complexity: 'beginner'
  },
  {
    id: 'apache',
    name: 'apache-web',
    displayName: 'Apache HTTP Server',
    description: 'World\'s most used web server software',
    image: 'httpd:2.4-alpine',
    category: 'web',
    iconKey: 'apache',
    defaultPort: 8102,
    defaultEnv: {},
    documentation: 'https://httpd.apache.org/docs/',
    tags: ['web', 'apache', 'http', 'server'],
    popular: false,
    version: '2.4',
    memoryRequirement: '128MB',
    complexity: 'beginner'
  },

  // === DEVELOPMENT RUNTIMES ===
  {
    id: 'node',
    name: 'node-app',
    displayName: 'Node.js',
    description: 'JavaScript runtime built on Chrome\'s V8 JavaScript engine',
    image: 'node:20-alpine',
    category: 'development',
    iconKey: 'node',
    defaultPort: 8097,
    defaultEnv: {
      'NODE_ENV': 'development'
    },
    documentation: 'https://nodejs.org/en/docs/',
    tags: ['javascript', 'runtime', 'backend', 'v8'],
    popular: true,
    version: '20 LTS',
    memoryRequirement: '256MB',
    complexity: 'intermediate'
  },
  {
    id: 'python',
    name: 'python-app',
    displayName: 'Python',
    description: 'Python runtime for applications, scripts, and data science',
    image: 'python:3.12-alpine',
    category: 'development',
    iconKey: 'python',
    defaultPort: 8098,
    defaultEnv: {
      'PYTHONUNBUFFERED': '1'
    },
    documentation: 'https://docs.python.org/',
    tags: ['python', 'runtime', 'backend', 'data-science'],
    popular: true,
    version: '3.12',
    memoryRequirement: '256MB',
    complexity: 'intermediate'
  },
  {
    id: 'openjdk',
    name: 'java-app',
    displayName: 'OpenJDK (Java)',
    description: 'OpenJDK Java runtime for enterprise applications',
    image: 'openjdk:21-jdk-slim',
    category: 'development',
    iconKey: 'java',
    defaultPort: 8103,
    defaultEnv: {
      'JAVA_OPTS': '-Xms256m -Xmx512m'
    },
    documentation: 'https://openjdk.org/guide/',
    tags: ['java', 'jvm', 'enterprise', 'spring'],
    popular: false,
    version: '21 LTS',
    memoryRequirement: '512MB',
    complexity: 'intermediate'
  },

  // === MONITORING & OBSERVABILITY ===
  {
    id: 'grafana',
    name: 'grafana',
    displayName: 'Grafana',
    description: 'Open observability platform for metrics, logs, and traces',
    image: 'grafana/grafana:latest',
    category: 'monitoring',
    iconKey: 'grafana',
    defaultPort: 8100,
    defaultEnv: {
      'GF_SECURITY_ADMIN_USER': 'admin',
      'GF_SECURITY_ADMIN_PASSWORD': 'password123'
    },
    documentation: 'https://grafana.com/docs/',
    tags: ['monitoring', 'dashboards', 'metrics', 'observability'],
    popular: true,
    version: '10.2',
    memoryRequirement: '256MB',
    complexity: 'intermediate'
  },

  // === STORAGE ===
  {
    id: 'minio',
    name: 'minio',
    displayName: 'MinIO',
    description: 'High-performance S3-compatible object storage',
    image: 'minio/minio:latest',
    category: 'storage',
    iconKey: 'minio',
    defaultPort: 8104,
    additionalPorts: [8105], // Console UI
    defaultEnv: {
      'MINIO_ROOT_USER': 'admin',
      'MINIO_ROOT_PASSWORD': 'password123'
    },
    documentation: 'https://min.io/docs/',
    tags: ['storage', 'object-storage', 's3', 'files'],
    popular: false,
    version: 'Latest',
    memoryRequirement: '256MB',
    complexity: 'intermediate'
  }
]

export const getTemplatesByCategory = (category?: string) => {
  if (!category) return serviceTemplates
  return serviceTemplates.filter(template => template.category === category)
}

export const getPopularTemplates = () => {
  return serviceTemplates.filter(template => template.popular)
}

export const getTemplateById = (id: string) => {
  return serviceTemplates.find(template => template.id === id)
}

export const getComplexityIcon = (complexity: ServiceTemplate['complexity']) => {
  switch (complexity) {
    case 'beginner': return '🟢'
    case 'intermediate': return '🟡' 
    case 'advanced': return '🔴'
  }
}

export const getComplexityColor = (complexity: ServiceTemplate['complexity']) => {
  switch (complexity) {
    case 'beginner': return 'text-green-600 dark:text-green-400'
    case 'intermediate': return 'text-yellow-600 dark:text-yellow-400'
    case 'advanced': return 'text-red-600 dark:text-red-400'
  }
}

export const searchTemplates = (templates: ServiceTemplate[], query: string) => {
  if (!query.trim()) return templates
  
  const searchTerm = query.toLowerCase().trim()
  return templates.filter(template => 
    template.displayName.toLowerCase().includes(searchTerm) ||
    template.description.toLowerCase().includes(searchTerm) ||
    template.tags.some(tag => tag.toLowerCase().includes(searchTerm))
  )
}