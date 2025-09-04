---
title: Troubleshooting
section: Guides
slug: guides/troubleshoot
tags: troubleshooting, issues, problems, support
version: v1
audience: user
---

# Troubleshooting Guide

Common issues and solutions for GLINRDOCK users.

## Installation Issues

### Cannot Download GLINRDOCK

**Problem**: Download fails or times out during installation.

**Solution**:
- Check your internet connection
- Try downloading from an alternative mirror
- Verify firewall settings allow HTTPS connections
- Contact your system administrator if on a corporate network

### Permission Denied Errors

**Problem**: Installation fails with permission errors.

**Solution**:
- Make sure you're running installation commands with `sudo`
- Check that your user has permission to write to `/usr/local/bin`
- Verify the installation directory exists and is writable

## Dashboard Access Issues

### Cannot Access Dashboard

**Problem**: Dashboard doesn't load at `http://your-server:8080`.

**Solutions**:
- Verify GLINRDOCK is running: check system status
- Check if port 8080 is blocked by firewall
- Try accessing via `http://localhost:8080` if on the same machine
- Check the configured port in your GLINRDOCK settings

### Dashboard Loads But Shows Errors

**Problem**: Dashboard loads but displays error messages.

**Solutions**:
- Refresh the page and clear browser cache
- Check browser developer console for JavaScript errors
- Verify all required services are running
- Restart GLINRDOCK service

## Service Deployment Issues

### Service Fails to Start

**Problem**: Deployed services show "Failed" or "Error" status.

**Common Causes & Solutions**:

1. **Container image not found**:
   - Verify the image name and tag are correct
   - Check if the image exists in the specified registry
   - Ensure registry credentials are configured if needed

2. **Port conflicts**:
   - Check if the port is already in use by another service
   - Use a different port or stop the conflicting service

3. **Resource constraints**:
   - Verify sufficient memory and CPU are available
   - Check disk space on the server
   - Review resource limits in service configuration

### Slow Service Startup

**Problem**: Services take a long time to start.

**Solutions**:
- Large container images take time to download on first run
- Check internet connection speed
- Consider using smaller or optimized base images
- Pre-pull commonly used images

## Routing and HTTPS Issues

### Domain Not Resolving

**Problem**: Custom domain doesn't reach your application.

**Solutions**:
- Verify DNS settings point to your server's IP address
- Check DNS propagation (can take up to 24 hours)
- Test with direct IP access first
- Verify firewall allows traffic on port 80 and 443

### HTTPS Certificate Errors

**Problem**: SSL/HTTPS certificate issues.

**Solutions**:
- Wait for automatic certificate generation (can take a few minutes)
- Verify domain DNS is pointing to your server
- Check that ports 80 and 443 are accessible from the internet
- Restart GLINRDOCK service if certificates seem stuck

## Performance Issues

### Slow Dashboard Response

**Problem**: Dashboard is slow or unresponsive.

**Solutions**:
- Check server resource usage (CPU, memory, disk)
- Restart GLINRDOCK service
- Clear browser cache and cookies
- Check for running services consuming resources

### High Memory Usage

**Problem**: Server running out of memory.

**Solutions**:
- Review resource limits for deployed services
- Stop unused services
- Consider upgrading server resources
- Monitor resource usage in the dashboard

## Search and Navigation Issues

### Search Not Working

**Problem**: Search function returns no results or errors.

**Solutions**:
- Wait for search index to complete (may take a few minutes)
- Try different search terms
- Clear browser cache
- Restart GLINRDOCK service

## Getting Additional Help

### Log Files

Check GLINRDOCK logs for detailed error information:
```bash
journalctl -u glinrdock -f
```

### System Information

Gather system information for support:
- GLINRDOCK version
- Operating system and version
- Available resources (CPU, memory, disk)
- Error messages from logs

### Community Support

If these solutions don't help:
- Visit the [GLINRDOCK community](https://github.com/GLINCKER/glinrdock-release)
- Check existing issues and discussions
- Create a new issue with detailed information about your problem

### Documentation

For more technical details:
- Review the [technical documentation](../../docs/README.md)
- Check the [API documentation](../../docs/reference/API.md)
- See [installation troubleshooting](../../docs/guides/INSTALL.md)