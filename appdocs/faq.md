---
title: Frequently Asked Questions
section: Support
slug: faq
tags: faq, questions, answers, help, support
version: v1
audience: user
---

# Frequently Asked Questions

Common questions and answers about using GLINRDOCK.

## Getting Started

### What is GLINRDOCK?

GLINRDOCK is a lightweight container management platform that simplifies deploying and managing containerized applications. It provides an intuitive web interface for deploying services, managing routes, and monitoring your applications.

### Do I need Docker experience to use GLINRDOCK?

No, GLINRDOCK is designed to be user-friendly for people without extensive Docker knowledge. However, basic understanding of containers and web applications is helpful.

### What types of applications can I deploy?

You can deploy any containerized application, including:
- Web applications (Node.js, Python, PHP, Java)
- Databases (PostgreSQL, MySQL, Redis, MongoDB)
- Static websites and blogs
- APIs and microservices
- Development tools and services

### How much does GLINRDOCK cost?

GLINRDOCK is open-source and free to use. You only pay for the server infrastructure where you run it.

## Installation and Setup

### What are the minimum system requirements?

- 2GB RAM (4GB recommended)
- 20GB available disk space
- Linux operating system (Ubuntu 20.04+ recommended)
- Internet connection for downloading containers

### Can I install GLINRDOCK on Windows or macOS?

GLINRDOCK is designed for Linux servers. For development, you can use Docker Desktop on Windows/macOS, but production deployments should use Linux.

### How do I update GLINRDOCK?

Run the installation script again to update to the latest version:
```bash
curl -fsSL https://install.glinrdock.com | bash
```

### Can I migrate from other platforms?

Yes, you can migrate from platforms like Docker Compose, Portainer, or manual Docker setups. Export your configurations and recreate them in GLINRDOCK.

## Services and Deployments

### How do I deploy my first application?

1. Go to **Services** in the dashboard
2. Click **Add Service**
3. Choose **From Template** for common applications or **Custom** for specific containers
4. Configure your service settings
5. Click **Deploy**

### Can I use my own Docker images?

Yes, you can deploy any Docker image from Docker Hub, private registries, or images you've built yourself.

### How do I update a running service?

1. Go to the service details page
2. Click **Edit** to modify configuration
3. Update the container image tag or other settings
4. Click **Save** to redeploy with new settings

### What happens if my service crashes?

GLINRDOCK automatically restarts failed services. You can configure health checks to monitor service health and get notified of issues.

## Domains and Routing

### How do I connect my domain to GLINRDOCK?

1. Create a route in GLINRDOCK pointing to your service
2. Update your domain's DNS settings to point to your server's IP address
3. GLINRDOCK will automatically obtain SSL certificates

### Do I get HTTPS automatically?

Yes, GLINRDOCK automatically obtains and manages SSL certificates from Let's Encrypt for all your domains.

### Can I use subdomains?

Yes, you can create routes for subdomains like `api.example.com` or `blog.example.com`. Each subdomain can point to a different service.

### What if my domain doesn't work immediately?

DNS changes can take up to 24 hours to propagate worldwide. You can test with your server's IP address first, then switch to the domain once DNS is updated.

## Security and Access

### Is GLINRDOCK secure?

Yes, GLINRDOCK includes several security features:
- Automatic HTTPS with SSL certificates
- Role-based access control
- Encrypted secrets and environment variables
- Audit logging and monitoring

### How do I manage user access?

Go to **Settings** > **Users** to add team members and assign roles (Admin, Deployer, or Viewer).

### Where are my secrets and passwords stored?

Sensitive data is encrypted at rest and never stored in plain text. Secrets are masked in the interface and only accessible to authorized users.

### Can I backup my data?

Yes, you can export your configurations and data. Go to **Settings** > **Backup** to create backups of your GLINRDOCK configuration.

## Performance and Resources

### How much traffic can GLINRDOCK handle?

This depends on your server resources and application requirements. GLINRDOCK itself is lightweight and adds minimal overhead to your applications.

### Can I scale my applications?

Currently, GLINRDOCK focuses on single-node deployments. For high-scale applications requiring multiple servers, consider using Kubernetes or Docker Swarm.

### How do I monitor resource usage?

The dashboard shows CPU, memory, and network usage for your services. You can also access detailed metrics and logs for each service.

### What if I run out of disk space?

Monitor disk usage in the dashboard and clean up unused containers/images. Consider adding more storage or implementing automated cleanup policies.

## Integrations

### Does GLINRDOCK work with GitHub?

Yes, GLINRDOCK has GitHub integration for automated deployments. Connect your repositories to automatically deploy on code changes.

### Can I use private Docker registries?

Yes, configure registry credentials in **Settings** > **Registries** to pull from private container registries.

### Does it integrate with monitoring tools?

GLINRDOCK provides metrics endpoints compatible with Prometheus and other monitoring systems.

### Can I use it with CI/CD pipelines?

Yes, GLINRDOCK has an API for integration with CI/CD tools like GitHub Actions, Jenkins, or GitLab CI.

## Troubleshooting

### My service won't start. What should I check?

1. Verify the container image name and tag are correct
2. Check that the port configuration matches your application
3. Review the service logs for error messages
4. Ensure sufficient resources (CPU, memory) are available

### HTTPS isn't working for my domain

1. Verify DNS points to your server's IP address
2. Ensure ports 80 and 443 are open to the internet
3. Check that the domain is correctly configured in your route
4. Wait for Let's Encrypt certificate generation (can take a few minutes)

### The dashboard is slow or unresponsive

1. Check server resource usage (CPU, memory)
2. Restart the GLINRDOCK service
3. Clear your browser cache
4. Check for browser console errors

### I can't connect to my applications

1. Verify the service is running (green status in dashboard)
2. Check route configuration and domain DNS settings
3. Test with direct IP access first
4. Review firewall settings on your server

## Support and Community

### Where can I get help?

- Check this FAQ and the [troubleshooting guide](./guides/troubleshoot.md)
- Visit the [GLINRDOCK community](https://github.com/GLINCKER/glinrdock-release)
- Review the [complete documentation](../docs/README.md)
- Search existing issues and discussions

### How do I report bugs or request features?

Create an issue on the [GLINRDOCK community repository](https://github.com/GLINCKER/glinrdock-release/issues) with:
- Detailed description of the problem or feature request
- Steps to reproduce (for bugs)
- Your GLINRDOCK version and system information
- Relevant log files or screenshots

### Can I contribute to GLINRDOCK?

Yes! GLINRDOCK is open-source. You can contribute by:
- Reporting bugs and suggesting features
- Contributing documentation improvements
- Sharing your use cases and feedback
- Helping other community members

### Is there commercial support available?

For enterprise support and consulting, contact the GLINRDOCK team through the community repository.

## Advanced Questions

### Can I run multiple GLINRDOCK instances?

You can run multiple instances on different servers, but they don't currently share data or provide high availability clustering.

### Does GLINRDOCK support ARM processors?

GLINRDOCK supports ARM64 processors. Ensure your container images are also available for ARM architecture.

### Can I customize the GLINRDOCK interface?

The interface isn't directly customizable, but you can use the API to build custom integrations and tools.

### How does GLINRDOCK compare to other platforms?

GLINRDOCK focuses on simplicity and single-node deployments, making it ideal for small to medium applications. For large-scale distributed applications, consider Kubernetes or Docker Swarm.

Still have questions? Check our [complete documentation](../docs/README.md) or visit the [community](https://github.com/GLINCKER/glinrdock-release) for more help.