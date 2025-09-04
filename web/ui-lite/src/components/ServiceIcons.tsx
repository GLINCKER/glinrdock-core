// Service Icons - Hybrid approach: Brand icons with offline fallback
import { useState, useEffect } from "preact/hooks";
import {
  Database,
  Zap,
  Layers,
  Globe,
  MessageSquare,
  Radio,
  BarChart3,
  Code,
  FolderOpen,
  Container,
  Server,
  Cpu,
} from "lucide-preact";

interface IconProps {
  className?: string;
  size?: number;
  color?: string;
}

import { settings } from "../utils/settings";
import { CachedSimpleIcon } from "./CachedSimpleIcon";

// Dynamic configuration based on user preference
const getPreferBrandIcons = () => {
  const preference = settings.preferBrandIcons;
  return preference;
};

// Service icon mapping with bundled Lucide icons
const ServiceIconComponents = {
  postgresql: Database,
  redis: Zap,
  mongodb: Database,
  mysql: Database,
  nginx: Globe,
  apache: Globe,
  nodedotjs: Code,
  node: Code,
  python: Code,
  java: Code,
  rabbitmq: MessageSquare,
  elasticsearch: Database,
  grafana: BarChart3,
  kafka: Radio,
  minio: FolderOpen,
  docker: Container,
} as const;

// Color mapping for different services
const ServiceColors = {
  postgresql: "#336791",
  redis: "#DC382D",
  mongodb: "#47A248",
  mysql: "#4479A1",
  nginx: "#269539",
  apache: "#D22128",
  nodedotjs: "#339933",
  node: "#339933",
  python: "#3776AB",
  java: "#ED8B00",
  rabbitmq: "#FF6600",
  elasticsearch: "#FEC514",
  grafana: "#F46800",
  kafka: "#231F20",
  minio: "#C72E29",
  docker: "#2496ED",
} as const;

// Simple Icons CDN mapping for brand icons
const BrandIconSlugs = {
  postgresql: "postgresql",
  redis: "redis",
  mongodb: "mongodb",
  mysql: "mysql",
  nginx: "nginx",
  apache: "apache",
  nodedotjs: "nodedotjs",
  node: "nodedotjs",
  python: "python",
  java: "openjdk",
  rabbitmq: "rabbitmq",
  elasticsearch: "elasticsearch",
  grafana: "grafana",
  kafka: "apachekafka",
  minio: "minio",
  docker: "docker",
  // Additional services (only include ones that exist on Simple Icons)
  traefik: "traefikproxy",
  caddy: "caddy",
  sonarqube: "sonarqubecloud",
  vault: "vault",
  consul: "consul",
  portainer: "portainer",
  wordpress: "wordpress",
  ghost: "ghost",
  drupal: "drupal",
  nextcloud: "nextcloud",
  gitea: "gitea",
  gitlab: "gitlab",
  wireguard: "wireguard",
  openvpn: "openvpn",
  transmission: "transmission",
  plex: "plex",
  jellyfin: "jellyfin",
  // Additional commonly used services
  mariadb: "mariadb",
  influxdb: "influxdb",
  prometheus: "prometheus",
  jenkins: "jenkins",
  cassandra: "apachecassandra",
  jaeger: "jaeger",
  solr: "apachesolr",
  kibana: "kibana",
  logstash: "logstash",
  victoriametrics: "victoriametrics",
  airflow: "apacheairflow",
  superset: "apachesuperset",
  n8n: "n8n",
  strapi: "strapi",
  directus: "directus",
  hasura: "hasura",
  supabase: "supabase",
  appwrite: "appwrite",
  plausible: "plausibleanalytics",
  umami: "umami",
  matomo: "matomo",
  uptimekuma: "uptimekuma",
  bitwarden: "bitwarden",
  firefox: "firefox",
  syncthing: "syncthing",
  meilisearch: "meilisearch",
  opensearch: "opensearch",
  visualstudiocode: "visualstudiocode",
  // Additional database and development tools
  etcd: "etcd",
  phpmyadmin: "phpmyadmin",
  adminer: "adminer",
  joomla: "joomla",
  // Security and authentication
  keycloak: "keycloak",
  authentik: "authentik",
  // Networking and VPN
  pihole: "pihole",
  // DNS and networking tools
  // Media automation (*arr stack)
  sonarr: "sonarr",
  radarr: "radarr",
  lidarr: "lidarr",
  bazarr: "bazarr",
  jackett: "jackett",
  // Torrent clients
  qbittorrent: "qbittorrent",
  deluge: "deluge",
  // Additional services (only ones that exist in Simple Icons)
  golang: "go",
  php: "php",
  ruby: "ruby",
  dotnet: "dotnet",
  dgraph: "dgraph",
  metabase: "metabase",
  prefect: "prefect",
  // Game/Panel services
  pterodactyl: "pterodactyl",
  // Docker base images  
  ubuntu: "ubuntu",
  linux: "linux",
  apple: "apple",
} as const;

// Service detection patterns - much cleaner and maintainable
const SERVICE_PATTERNS = [
  // Core services with exact matches
  {
    patterns: ["postgres"],
    icon: ServiceIconComponents.postgresql,
    color: ServiceColors.postgresql,
    name: "PostgreSQL",
    slug: "postgresql",
  },
  {
    patterns: ["redis"],
    icon: ServiceIconComponents.redis,
    color: ServiceColors.redis,
    name: "Redis",
    slug: "redis",
  },
  {
    patterns: ["mongo"],
    icon: ServiceIconComponents.mongodb,
    color: ServiceColors.mongodb,
    name: "MongoDB",
    slug: "mongodb",
  },
  {
    patterns: ["mysql"],
    icon: ServiceIconComponents.mysql,
    color: ServiceColors.mysql,
    name: "MySQL",
    slug: "mysql",
  },
  {
    patterns: ["mariadb"],
    icon: ServiceIconComponents.mysql,
    color: ServiceColors.mysql,
    name: "MariaDB",
    slug: "mariadb",
  },
  {
    patterns: ["nginx"],
    icon: ServiceIconComponents.nginx,
    color: ServiceColors.nginx,
    name: "Nginx",
    slug: "nginx",
  },
  {
    patterns: ["apache", "httpd"],
    icon: ServiceIconComponents.apache,
    color: ServiceColors.apache,
    name: "Apache",
    slug: "apache",
  },
  {
    patterns: ["node"],
    icon: ServiceIconComponents.nodedotjs,
    color: ServiceColors.nodedotjs,
    name: "Node.js",
    slug: "nodedotjs",
  },
  {
    patterns: ["python"],
    icon: ServiceIconComponents.python,
    color: ServiceColors.python,
    name: "Python",
    slug: "python",
  },
  {
    patterns: ["openjdk", "java"],
    icon: ServiceIconComponents.java,
    color: ServiceColors.java,
    name: "Java",
    slug: "openjdk",
  },
  {
    patterns: ["rabbitmq"],
    icon: ServiceIconComponents.rabbitmq,
    color: ServiceColors.rabbitmq,
    name: "RabbitMQ",
    slug: "rabbitmq",
  },
  {
    patterns: ["elasticsearch", "elastic"],
    icon: ServiceIconComponents.elasticsearch,
    color: ServiceColors.elasticsearch,
    name: "Elasticsearch",
    slug: "elasticsearch",
  },
  {
    patterns: ["grafana"],
    icon: ServiceIconComponents.grafana,
    color: ServiceColors.grafana,
    name: "Grafana",
    slug: "grafana",
  },
  {
    patterns: ["kafka"],
    icon: ServiceIconComponents.kafka,
    color: ServiceColors.kafka,
    name: "Kafka",
    slug: "apachekafka",
  },
  {
    patterns: ["minio"],
    icon: ServiceIconComponents.minio,
    color: ServiceColors.minio,
    name: "MinIO",
    slug: "minio",
  },
  {
    patterns: ["docker"],
    icon: ServiceIconComponents.docker,
    color: ServiceColors.docker,
    name: "Docker",
    slug: "docker",
  },

  // Database services
  {
    patterns: ["influxdb"],
    icon: ServiceIconComponents.elasticsearch,
    color: "#22ADF6",
    name: "InfluxDB",
    slug: "influxdb",
  },
  {
    patterns: ["cassandra"],
    icon: Database,
    color: "#1287B1",
    name: "Cassandra",
    slug: "apachecassandra",
  },
  {
    patterns: ["clickhouse"],
    icon: Database,
    color: "#FFCC00",
    name: "ClickHouse",
    slug: "clickhouse",
  },
  {
    patterns: ["cockroach"],
    icon: Database,
    color: "#6933FF",
    name: "CockroachDB",
    slug: "cockroachlabs",
  },
  { patterns: ["neo4j"], icon: Database, color: "#008CC1", name: "Neo4j", slug: "neo4j" },
  {
    patterns: ["arangodb"],
    icon: Database,
    color: "#68A063",
    name: "ArangoDB",
    slug: "arangodb",
  },

  // Monitoring & Observability
  {
    patterns: ["prometheus", "prom/"],
    icon: ServiceIconComponents.grafana,
    color: "#E6522C",
    name: "Prometheus",
    slug: "prometheus",
  },
  {
    patterns: ["jaeger"],
    icon: ServiceIconComponents.grafana,
    color: "#60D0E4",
    name: "Jaeger",
    slug: "jaeger",
  },
  {
    patterns: ["zipkin"],
    icon: ServiceIconComponents.grafana,
    color: "#FF6B35",
    name: "Zipkin",
  },
  {
    patterns: ["kibana"],
    icon: ServiceIconComponents.grafana,
    color: "#005571",
    name: "Kibana",
    slug: "kibana",
  },
  {
    patterns: ["logstash"],
    icon: ServiceIconComponents.grafana,
    color: "#005571",
    name: "Logstash",
    slug: "logstash",
  },
  {
    patterns: ["loki"],
    icon: ServiceIconComponents.grafana,
    color: "#F46800",
    name: "Loki",
    slug: "grafana",
  },
  {
    patterns: ["tempo"],
    icon: ServiceIconComponents.grafana,
    color: "#F46800",
    name: "Tempo",
    slug: "grafana",
  },
  {
    patterns: ["victoria"],
    icon: ServiceIconComponents.grafana,
    color: "#621773",
    name: "VictoriaMetrics",
    slug: "victoriametrics",
  },
  {
    patterns: ["alertmanager"],
    icon: ServiceIconComponents.grafana,
    color: "#E6522C",
    name: "Alertmanager",
    slug: "prometheus",
  },

  // Development Tools
  {
    patterns: ["jenkins"],
    icon: ServiceIconComponents.docker,
    color: "#D33833",
    name: "Jenkins",
    slug: "jenkins",
  },
  {
    patterns: ["code-server"],
    icon: ServiceIconComponents.nodedotjs,
    color: "#007ACC",
    name: "Code Server",
    slug: "visualstudiocode",
  },
  {
    patterns: ["theia"],
    icon: ServiceIconComponents.nodedotjs,
    color: "#0B5394",
    name: "Eclipse Theia",
    slug: "eclipseide",
  },

  // Web Proxies & Load Balancers
  {
    patterns: ["traefik"],
    icon: ServiceIconComponents.nginx,
    color: "#24A1C1",
    name: "Traefik",
    slug: "traefikproxy",
  },
  {
    patterns: ["caddy"],
    icon: ServiceIconComponents.nginx,
    color: "#1F88C0",
    name: "Caddy",
    slug: "caddy",
  },

  // Cache & Message Queues
  {
    patterns: ["memcached"],
    icon: ServiceIconComponents.redis,
    color: "#1db4e8",
    name: "Memcached",
  },
  {
    patterns: ["hazelcast"],
    icon: ServiceIconComponents.redis,
    color: "#FF6900",
    name: "Hazelcast",
  },

  // Search Engines
  {
    patterns: ["solr"],
    icon: ServiceIconComponents.elasticsearch,
    color: "#D9411E",
    name: "Apache Solr",
    slug: "apachesolr",
  },
  {
    patterns: ["meilisearch"],
    icon: ServiceIconComponents.elasticsearch,
    color: "#FF5CAA",
    name: "MeiliSearch",
    slug: "meilisearch",
  },
  {
    patterns: ["opensearch"],
    icon: ServiceIconComponents.elasticsearch,
    color: "#005EB8",
    name: "OpenSearch",
    slug: "opensearch",
  },

  // Storage & File Management
  {
    patterns: ["nextcloud"],
    icon: ServiceIconComponents.minio,
    color: "#0082C9",
    name: "Nextcloud",
    slug: "nextcloud",
  },
  {
    patterns: ["owncloud"],
    icon: ServiceIconComponents.minio,
    color: "#1D2D44",
    name: "ownCloud",
    slug: "owncloud",
  },
  {
    patterns: ["seafile"],
    icon: ServiceIconComponents.minio,
    color: "#FF8C00",
    name: "Seafile",
  },
  {
    patterns: ["syncthing"],
    icon: ServiceIconComponents.minio,
    color: "#0891D1",
    name: "Syncthing",
    slug: "syncthing",
  },
  {
    patterns: ["filebrowser"],
    icon: ServiceIconComponents.minio,
    color: "#007d9c",
    name: "FileBrowser",
  },

  // Version Control
  {
    patterns: ["gitea"],
    icon: ServiceIconComponents.nginx,
    color: "#609926",
    name: "Gitea",
    slug: "gitea",
  },
  {
    patterns: ["gitlab"],
    icon: ServiceIconComponents.nginx,
    color: "#FC6D26",
    name: "GitLab",
    slug: "gitlab",
  },

  // Security & Authentication
  {
    patterns: ["vault"],
    icon: ServiceIconComponents.nginx,
    color: "#000000",
    name: "Vault",
    slug: "vault",
  },
  {
    patterns: ["consul"],
    icon: ServiceIconComponents.nginx,
    color: "#CA2171",
    name: "Consul",
    slug: "consul",
  },
  {
    patterns: ["keycloak"],
    icon: ServiceIconComponents.nginx,
    color: "#4D4D4D",
    name: "Keycloak",
    slug: "keycloak",
  },
  {
    patterns: ["vaultwarden"],
    icon: ServiceIconComponents.nginx,
    color: "#175DDC",
    name: "Vaultwarden",
    slug: "bitwarden",
  },
  {
    patterns: ["bitwarden"],
    icon: ServiceIconComponents.nginx,
    color: "#175DDC",
    name: "Bitwarden",
    slug: "bitwarden",
  },

  // Content Management
  {
    patterns: ["wordpress"],
    icon: ServiceIconComponents.nginx,
    color: "#21759B",
    name: "WordPress",
    slug: "wordpress",
  },
  {
    patterns: ["ghost"],
    icon: ServiceIconComponents.nginx,
    color: "#15171A",
    name: "Ghost",
    slug: "ghost",
  },
  {
    patterns: ["drupal"],
    icon: ServiceIconComponents.nginx,
    color: "#0073BA",
    name: "Drupal",
    slug: "drupal",
  },
  {
    patterns: ["strapi"],
    icon: ServiceIconComponents.nodedotjs,
    color: "#2F2E8B",
    name: "Strapi",
    slug: "strapi",
  },

  // Media & Entertainment
  {
    patterns: ["plex"],
    icon: ServiceIconComponents.nginx,
    color: "#E5A00D",
    name: "Plex",
    slug: "plex",
  },
  {
    patterns: ["jellyfin"],
    icon: ServiceIconComponents.nginx,
    color: "#00A4DC",
    name: "Jellyfin",
    slug: "jellyfin",
  },

  // Analytics
  {
    patterns: ["plausible"],
    icon: ServiceIconComponents.grafana,
    color: "#5850EC",
    name: "Plausible",
    slug: "plausibleanalytics",
  },
  {
    patterns: ["umami"],
    icon: ServiceIconComponents.grafana,
    color: "#FF6B35",
    name: "Umami",
    slug: "umami",
  },
  {
    patterns: ["matomo"],
    icon: ServiceIconComponents.grafana,
    color: "#3450A3",
    name: "Matomo",
    slug: "matomo",
  },

  // LinuxServer.io images
  {
    patterns: ["linuxserver/sonarr"],
    icon: ServiceIconComponents.nginx,
    color: "#35C5F0",
    name: "Sonarr",
    slug: "sonarr",
  },
  {
    patterns: ["linuxserver/radarr"],
    icon: ServiceIconComponents.nginx,
    color: "#FFC230",
    name: "Radarr",
    slug: "radarr",
  },
  {
    patterns: ["linuxserver/bazarr"],
    icon: ServiceIconComponents.nginx,
    color: "#FF6900",
    name: "Bazarr",
    slug: "bazarr",
  },
  {
    patterns: ["linuxserver/lidarr"],
    icon: ServiceIconComponents.nginx,
    color: "#159552",
    name: "Lidarr",
    slug: "lidarr",
  },
  {
    patterns: ["linuxserver/readarr"],
    icon: ServiceIconComponents.nginx,
    color: "#D4AF37",
    name: "Readarr",
  },
  {
    patterns: ["linuxserver/prowlarr"],
    icon: ServiceIconComponents.nginx,
    color: "#FF6B35",
    name: "Prowlarr",
  },
  {
    patterns: ["linuxserver/jackett"],
    icon: ServiceIconComponents.nginx,
    color: "#9F1D20",
    name: "Jackett",
    slug: "jackett",
  },
  {
    patterns: ["linuxserver/overseerr"],
    icon: ServiceIconComponents.nginx,
    color: "#5460E6",
    name: "Overseerr",
  },
  {
    patterns: ["linuxserver/tautulli"],
    icon: ServiceIconComponents.grafana,
    color: "#DBA81A",
    name: "Tautulli",
  },
  {
    patterns: ["linuxserver/heimdall"],
    icon: ServiceIconComponents.nginx,
    color: "#52C8F5",
    name: "Heimdall",
  },
  {
    patterns: ["linuxserver/organizr"],
    icon: ServiceIconComponents.nginx,
    color: "#1B1C1D",
    name: "Organizr",
  },
  {
    patterns: ["linuxserver/duplicati"],
    icon: ServiceIconComponents.minio,
    color: "#FF8C00",
    name: "Duplicati",
  },
  {
    patterns: ["linuxserver/plex"],
    icon: ServiceIconComponents.nginx,
    color: "#E5A00D",
    name: "Plex",
  },
  {
    patterns: ["linuxserver/jellyfin"],
    icon: ServiceIconComponents.nginx,
    color: "#00A4DC",
    name: "Jellyfin",
  },
  {
    patterns: ["linuxserver/emby"],
    icon: ServiceIconComponents.nginx,
    color: "#52B54B",
    name: "Emby",
  },
  {
    patterns: ["linuxserver/nextcloud"],
    icon: ServiceIconComponents.nginx,
    color: "#0082C9",
    name: "Nextcloud",
    slug: "nextcloud",
  },
  {
    patterns: ["linuxserver/photoprism"],
    icon: ServiceIconComponents.nginx,
    color: "#40BCF4",
    name: "PhotoPrism",
  },
  {
    patterns: ["linuxserver/bookstack"],
    icon: ServiceIconComponents.nginx,
    color: "#0288D1",
    name: "BookStack",
  },
  {
    patterns: ["linuxserver/wikijs"],
    icon: ServiceIconComponents.nginx,
    color: "#1976D2",
    name: "Wiki.js",
  },
  {
    patterns: ["linuxserver/code-server"],
    icon: ServiceIconComponents.nginx,
    color: "#007ACC",
    name: "Code Server",
  },
  {
    patterns: ["linuxserver/transmission"],
    icon: ServiceIconComponents.nginx,
    color: "#C41E3A",
    name: "Transmission",
    slug: "transmission",
  },
  {
    patterns: ["linuxserver/qbittorrent"],
    icon: ServiceIconComponents.nginx,
    color: "#2E5BBA",
    name: "qBittorrent",
    slug: "qbittorrent",
  },
  {
    patterns: ["linuxserver/deluge"],
    icon: ServiceIconComponents.nginx,
    color: "#D3D3D3",
    name: "Deluge",
    slug: "deluge",
  },
  {
    patterns: ["linuxserver/nzbget"],
    icon: ServiceIconComponents.nginx,
    color: "#37B24D",
    name: "NZBGet",
  },
  {
    patterns: ["linuxserver/sabnzbd"],
    icon: ServiceIconComponents.nginx,
    color: "#F7931A",
    name: "SABnzbd",
  },

  // Generic patterns for common image prefixes
  {
    patterns: ["sonarr"],
    icon: ServiceIconComponents.nginx,
    color: "#35C5F0",
    name: "Sonarr",
    slug: "sonarr",
  },
  {
    patterns: ["radarr"],
    icon: ServiceIconComponents.nginx,
    color: "#FFC230",
    name: "Radarr",
    slug: "radarr",
  },
  {
    patterns: ["bazarr"],
    icon: ServiceIconComponents.nginx,
    color: "#FF6900",
    name: "Bazarr",
    slug: "bazarr",
  },
  {
    patterns: ["sonarqube"],
    icon: ServiceIconComponents.nginx,
    color: "#4E9BCD",
    name: "SonarQube",
  },
  {
    patterns: ["couchbase"],
    icon: ServiceIconComponents.redis,
    color: "#EA2328",
    name: "Couchbase",
  },
  {
    patterns: ["couchdb"],
    icon: ServiceIconComponents.redis,
    color: "#E42528",
    name: "CouchDB",
    slug: "apachecouchdb",
  },
  {
    patterns: ["etcd"],
    icon: ServiceIconComponents.postgresql,
    color: "#419EDA",
    name: "etcd",
    slug: "etcd",
  },
  {
    patterns: ["phpmyadmin"],
    icon: ServiceIconComponents.mysql,
    color: "#F29111",
    name: "phpMyAdmin",
    slug: "phpmyadmin",
  },
  {
    patterns: ["adminer"],
    icon: ServiceIconComponents.mysql,
    color: "#34567C",
    name: "Adminer",
    slug: "adminer",
  },
  {
    patterns: ["joomla"],
    icon: ServiceIconComponents.nginx,
    color: "#5091CD",
    name: "Joomla",
    slug: "joomla",
  },
  {
    patterns: ["authentik"],
    icon: ServiceIconComponents.nginx,
    color: "#FF6A00",
    name: "authentik",
    slug: "authentik",
  },
  {
    patterns: ["pihole"],
    icon: ServiceIconComponents.nginx,
    color: "#96060C",
    name: "Pi-hole",
    slug: "pihole",
  },
  {
    patterns: ["unbound"],
    icon: ServiceIconComponents.nginx,
    color: "#E05D44",
    name: "Unbound",
  },
  // Additional services
  {
    patterns: ["haproxy"],
    icon: ServiceIconComponents.nginx,
    color: "#106DA9",
    name: "HAProxy",
  },
  {
    patterns: ["nats"],
    icon: ServiceIconComponents.nginx,
    color: "#199BFC",
    name: "NATS",
  },
  {
    patterns: ["rmohr/activemq", "activemq"],
    icon: ServiceIconComponents.nginx,
    color: "#AA1C16",
    name: "ActiveMQ",
  },
  {
    patterns: ["golang"],
    icon: ServiceIconComponents.nodedotjs,
    color: "#00ADD8",
    name: "Go",
    slug: "go",
  },
  {
    patterns: ["php"],
    icon: ServiceIconComponents.nodedotjs,
    color: "#777BB4",
    name: "PHP",
    slug: "php",
  },
  {
    patterns: ["ruby"],
    icon: ServiceIconComponents.nodedotjs,
    color: "#CC342D",
    name: "Ruby",
    slug: "ruby",
  },
  {
    patterns: ["mcr.microsoft.com/dotnet/runtime", "dotnet"],
    icon: ServiceIconComponents.nodedotjs,
    color: "#5C2D91",
    name: ".NET",
    slug: "dotnet",
  },
  {
    patterns: ["mailhog/mailhog", "mailhog"],
    icon: ServiceIconComponents.nginx,
    color: "#BA3925",
    name: "MailHog",
  },
  {
    patterns: ["zookeeper"],
    icon: ServiceIconComponents.nginx,
    color: "#D22128",
    name: "ZooKeeper",
  },
  {
    patterns: ["linuxserver/wireguard"],
    icon: ServiceIconComponents.nginx,
    color: "#88171A",
    name: "WireGuard",
    slug: "wireguard",
  },
  {
    patterns: ["kylemanna/openvpn"],
    icon: ServiceIconComponents.nginx,
    color: "#EA7E20",
    name: "OpenVPN",
    slug: "openvpn",
  },
  {
    patterns: ["internetsystemsconsortium/bind9", "bind9"],
    icon: ServiceIconComponents.nginx,
    color: "#4053D6",
    name: "BIND 9",
  },
  {
    patterns: ["dgraph/dgraph", "dgraph"],
    icon: ServiceIconComponents.postgresql,
    color: "#E50695",
    name: "Dgraph",
    slug: "dgraph",
  },
  {
    patterns: ["orientdb"],
    icon: ServiceIconComponents.postgresql,
    color: "#EE6A42",
    name: "OrientDB",
  },
  {
    patterns: ["questdb/questdb", "questdb"],
    icon: ServiceIconComponents.postgresql,
    color: "#D14671",
    name: "QuestDB",
  },
  {
    patterns: ["metabase/metabase", "metabase"],
    icon: ServiceIconComponents.nginx,
    color: "#509EE3",
    name: "Metabase",
    slug: "metabase",
  },
  {
    patterns: ["prefecthq/prefect", "prefect"],
    icon: ServiceIconComponents.nginx,
    color: "#024DFD",
    name: "Prefect",
    slug: "prefect",
  },
  {
    patterns: ["n8nio/n8n", "n8n"],
    icon: ServiceIconComponents.nginx,
    color: "#EA4B71",
    name: "n8n",
    slug: "n8n",
  },
  {
    patterns: ["nocodb/nocodb", "nocodb"],
    icon: ServiceIconComponents.nginx,
    color: "#FF792E",
    name: "NocoDB",
  },
  {
    patterns: ["hasura/graphql-engine", "hasura"],
    icon: ServiceIconComponents.nginx,
    color: "#1EB4D4",
    name: "Hasura",
    slug: "hasura",
  },
  {
    patterns: ["emby/embyserver"],
    icon: ServiceIconComponents.nginx,
    color: "#52B54B",
    name: "Emby",
  },

  // Other services
  {
    patterns: ["portainer"],
    icon: ServiceIconComponents.docker,
    color: "#13BEF9",
    name: "Portainer",
    slug: "portainer",
  },
  {
    patterns: ["watchtower"],
    icon: ServiceIconComponents.docker,
    color: "#2496ED",
    name: "Watchtower",
  },
  {
    patterns: ["uptime-kuma"],
    icon: ServiceIconComponents.grafana,
    color: "#5CDD8B",
    name: "Uptime Kuma",
    slug: "uptimekuma",
  },

  // Docker base image patterns
  {
    patterns: ["ubuntu"],
    icon: ServiceIconComponents.nginx,
    color: "#E95420",
    name: "Ubuntu",
    slug: "ubuntu",
  },
  {
    patterns: ["linux"],
    icon: ServiceIconComponents.nginx,
    color: "#FCC624",
    name: "Linux",
    slug: "linux",
  },
  {
    patterns: ["apple"],
    icon: ServiceIconComponents.nginx,
    color: "#000000",
    name: "Apple",
    slug: "apple",
  },

  // Game servers and management panels
  {
    patterns: ["pterodactyl"],
    icon: ServiceIconComponents.nginx,
    color: "#0E4688",
    name: "Pterodactyl Panel",
    slug: "pterodactyl",
  },
  {
    patterns: ["passbolt"],
    icon: ServiceIconComponents.nginx,
    color: "#D40101",
    name: "Passbolt",
  },
  {
    patterns: ["raspberry", "rasberry", "rpi"],
    icon: ServiceIconComponents.nginx,
    color: "#C51A4A",
    name: "Raspberry Pi",
  },
] as const;

// Helper function to get service info from image name
export const getServiceInfoFromImage = (
  imageName: string
): {
  icon: any;
  color: string;
  name: string;
  slug?: string;
} | null => {
  const image = imageName.toLowerCase();
  
  // Smart service detection - prioritize full image matching first
  // This handles cases like "opencsi/passbolt", "mdhamim/pterodactyl-panel"
  for (const service of SERVICE_PATTERNS) {
    if (service.patterns.some((pattern) => image.includes(pattern))) {
      return {
        icon: service.icon,
        color: service.color,
        name: service.name,
        slug: (service as any).slug,
      };
    }
  }

  // Fallback: Extract service name from path for simple cases
  // For "appleateme/apple" -> "apple" (when no specific patterns match)
  if (image.includes('/')) {
    const serviceName = image.split('/').pop() || image;
    
    // Check if the extracted name matches any patterns
    for (const service of SERVICE_PATTERNS) {
      if (service.patterns.some((pattern) => serviceName === pattern)) {
        return {
          icon: service.icon,
          color: service.color,
          name: service.name,
          slug: (service as any).slug,
        };
      }
    }
  }

  return null;
};

// Generic service icon component that auto-detects from image name
export const ServiceIcon = ({
  imageName,
  className = "w-8 h-8",
  size,
  color,
}: { imageName: string } & IconProps) => {
  const serviceInfo = getServiceInfoFromImage(imageName);


  if (!serviceInfo) {
    // Fallback to generic container icon
    return (
      <div
        className={`${className} bg-gray-200 dark:bg-gray-700 rounded flex items-center justify-center text-gray-500 dark:text-gray-400 text-xs font-bold`}
        style={{ width: size, height: size }}
      >
        <Server className="w-1/2 h-1/2" />
      </div>
    );
  }

  const IconComponent = serviceInfo.icon || Server; // Fallback to Server icon if undefined
  const iconColor = color || serviceInfo.color;

  return (
    <div
      className={`${className} rounded flex items-center justify-center`}
      data-service={imageName}
      style={{
        width: size,
        height: size,
        color: iconColor,
        backgroundColor: "transparent",
      }}
    >
      {serviceInfo.slug && getPreferBrandIcons() ? (
        <CachedSimpleIcon
          slug={serviceInfo.slug}
          color={serviceInfo.color.replace("#", "")}
          alt={serviceInfo.name}
          className="w-full h-full object-contain"
          onError={() => {
            // Show fallback icon when Simple Icon fails to load
            const parent = document.querySelector(`[data-service="${imageName}"]`);
            if (parent) {
              const simpleIconEl = parent.querySelector('.cached-simple-icon') as HTMLElement;
              const fallbackIcon = parent.querySelector('.fallback-icon') as HTMLElement;
              if (simpleIconEl) simpleIconEl.style.display = 'none';
              if (fallbackIcon) fallbackIcon.style.display = 'block';
            }
          }}
        />
      ) : null}
      <IconComponent
        className={`w-3/4 h-3/4 fallback-icon text-gray-600 dark:text-gray-300 ${
          serviceInfo.slug && getPreferBrandIcons() ? "hidden" : ""
        }`}
      />
    </div>
  );
};

// Individual service icon components using bundled icons
export const RedisIcon = ({ className, size, color }: IconProps) => (
  <ServiceIcon
    imageName="redis"
    className={className}
    size={size}
    color={color}
  />
);

export const PostgreSQLIcon = ({ className, size, color }: IconProps) => (
  <ServiceIcon
    imageName="postgresql"
    className={className}
    size={size}
    color={color}
  />
);

export const MongoDBIcon = ({ className, size, color }: IconProps) => (
  <ServiceIcon
    imageName="mongodb"
    className={className}
    size={size}
    color={color}
  />
);

export const NginxIcon = ({ className, size, color }: IconProps) => (
  <ServiceIcon
    imageName="nginx"
    className={className}
    size={size}
    color={color}
  />
);

export const RabbitMQIcon = ({ className, size, color }: IconProps) => (
  <ServiceIcon
    imageName="rabbitmq"
    className={className}
    size={size}
    color={color}
  />
);

export const ElasticsearchIcon = ({ className, size, color }: IconProps) => (
  <ServiceIcon
    imageName="elasticsearch"
    className={className}
    size={size}
    color={color}
  />
);

export const NodeJSIcon = ({ className, size, color }: IconProps) => (
  <ServiceIcon
    imageName="node"
    className={className}
    size={size}
    color={color}
  />
);

export const PythonIcon = ({ className, size, color }: IconProps) => (
  <ServiceIcon
    imageName="python"
    className={className}
    size={size}
    color={color}
  />
);

export const MySQLIcon = ({ className, size, color }: IconProps) => (
  <ServiceIcon
    imageName="mysql"
    className={className}
    size={size}
    color={color}
  />
);

export const GrafanaIcon = ({ className, size, color }: IconProps) => (
  <ServiceIcon
    imageName="grafana"
    className={className}
    size={size}
    color={color}
  />
);

export const DockerIcon = ({ className, size, color }: IconProps) => (
  <ServiceIcon
    imageName="docker"
    className={className}
    size={size}
    color={color}
  />
);

export const ApacheIcon = ({ className, size, color }: IconProps) => (
  <ServiceIcon
    imageName="apache"
    className={className}
    size={size}
    color={color}
  />
);

export const JavaIcon = ({ className, size, color }: IconProps) => (
  <ServiceIcon
    imageName="java"
    className={className}
    size={size}
    color={color}
  />
);

export const KafkaIcon = ({ className, size, color }: IconProps) => (
  <ServiceIcon
    imageName="kafka"
    className={className}
    size={size}
    color={color}
  />
);

export const MinioIcon = ({ className, size, color }: IconProps) => (
  <ServiceIcon
    imageName="minio"
    className={className}
    size={size}
    color={color}
  />
);

// Icon mapping for service templates
export const ServiceIconMap = {
  redis: RedisIcon,
  postgres: PostgreSQLIcon,
  mongodb: MongoDBIcon,
  nginx: NginxIcon,
  rabbitmq: RabbitMQIcon,
  elasticsearch: ElasticsearchIcon,
  node: NodeJSIcon,
  python: PythonIcon,
  mysql: MySQLIcon,
  grafana: GrafanaIcon,
  docker: DockerIcon,
  apache: ApacheIcon,
  java: JavaIcon,
  kafka: KafkaIcon,
  minio: MinioIcon,
} as const;

export type ServiceIconKey = keyof typeof ServiceIconMap;
