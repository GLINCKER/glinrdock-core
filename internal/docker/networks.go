package docker

import (
	"context"
	"fmt"

	"github.com/docker/docker/api/types/filters"
	"github.com/docker/docker/api/types/network"
	"github.com/docker/docker/client"
	"github.com/rs/zerolog/log"
)

// NetworkManager handles Docker network operations
type NetworkManager struct {
	client *client.Client
}

// NewNetworkManager creates a new network manager
func NewNetworkManager(cli *client.Client) *NetworkManager {
	return &NetworkManager{client: cli}
}

// EnsureProjectNetwork ensures a project network exists
// Returns network ID, whether it already existed, and any error
func (nm *NetworkManager) EnsureProjectNetwork(ctx context.Context, networkName string, projectID int64) (string, bool, error) {
	// Check if network already exists
	networks, err := nm.client.NetworkList(ctx, network.ListOptions{
		Filters: filters.NewArgs(filters.Arg("name", networkName)),
	})
	if err != nil {
		return "", false, fmt.Errorf("failed to list networks: %w", err)
	}

	// If network exists, verify it's managed by glinrdock
	for _, net := range networks {
		if net.Name == networkName {
			// Check if it has our labels
			if owner, exists := net.Labels["owner"]; exists && owner == "glinrdock" {
				log.Debug().Str("network", networkName).Msg("project network already exists")
				return net.ID, true, nil
			}
			return "", false, fmt.Errorf("network %s exists but not managed by glinrdock", networkName)
		}
	}

	// Create the network
	createResp, err := nm.client.NetworkCreate(ctx, networkName, network.CreateOptions{
		Driver: "bridge",
		Labels: map[string]string{
			"owner":      "glinrdock",
			"project_id": fmt.Sprintf("%d", projectID),
		},
		Options: map[string]string{
			"com.docker.network.bridge.enable_icc":           "true",
			"com.docker.network.bridge.enable_ip_masquerade": "true",
		},
	})
	if err != nil {
		return "", false, fmt.Errorf("failed to create network %s: %w", networkName, err)
	}

	log.Info().Str("network", networkName).Str("id", createResp.ID).Int64("project_id", projectID).Msg("created project network")
	return createResp.ID, false, nil
}

// ConnectContainerToNetwork connects a container to a project network with aliases
func (nm *NetworkManager) ConnectContainerToNetwork(ctx context.Context, containerID, networkName string, aliases []string) error {
	err := nm.client.NetworkConnect(ctx, networkName, containerID, &network.EndpointSettings{
		Aliases: aliases,
	})
	if err != nil {
		return fmt.Errorf("failed to connect container %s to network %s: %w", containerID, networkName, err)
	}

	log.Debug().
		Str("container", containerID).
		Str("network", networkName).
		Strs("aliases", aliases).
		Msg("connected container to project network")

	return nil
}

// DisconnectContainerFromNetwork disconnects a container from a network
func (nm *NetworkManager) DisconnectContainerFromNetwork(ctx context.Context, containerID, networkName string, force bool) error {
	err := nm.client.NetworkDisconnect(ctx, networkName, containerID, force)
	if err != nil {
		return fmt.Errorf("failed to disconnect container %s from network %s: %w", containerID, networkName, err)
	}

	log.Debug().
		Str("container", containerID).
		Str("network", networkName).
		Bool("force", force).
		Msg("disconnected container from project network")

	return nil
}

// GetContainerNetworks returns the networks a container is connected to
func (nm *NetworkManager) GetContainerNetworks(ctx context.Context, containerID string) ([]ContainerNetwork, error) {
	inspect, err := nm.client.ContainerInspect(ctx, containerID)
	if err != nil {
		return nil, fmt.Errorf("failed to inspect container %s: %w", containerID, err)
	}

	var networks []ContainerNetwork
	for networkName, endpointSettings := range inspect.NetworkSettings.Networks {
		networks = append(networks, ContainerNetwork{
			Name:      networkName,
			ID:        endpointSettings.NetworkID,
			IPAddress: endpointSettings.IPAddress,
			Aliases:   endpointSettings.Aliases,
		})
	}

	return networks, nil
}

// RemoveProjectNetwork removes a project network if it exists
func (nm *NetworkManager) RemoveProjectNetwork(ctx context.Context, networkName string) error {
	// Check if network exists
	networks, err := nm.client.NetworkList(ctx, network.ListOptions{
		Filters: filters.NewArgs(filters.Arg("name", networkName)),
	})
	if err != nil {
		return fmt.Errorf("failed to list networks: %w", err)
	}

	for _, net := range networks {
		if net.Name == networkName {
			// Verify it's managed by glinrdock before removing
			if owner, exists := net.Labels["owner"]; !exists || owner != "glinrdock" {
				return fmt.Errorf("network %s not managed by glinrdock, refusing to remove", networkName)
			}

			err := nm.client.NetworkRemove(ctx, net.ID)
			if err != nil {
				return fmt.Errorf("failed to remove network %s: %w", networkName, err)
			}

			log.Info().Str("network", networkName).Str("id", net.ID).Msg("removed project network")
			return nil
		}
	}

	// Network doesn't exist, that's fine
	return nil
}

// ContainerNetwork represents a network connection for a container
type ContainerNetwork struct {
	Name      string   `json:"name"`
	ID        string   `json:"id"`
	IPAddress string   `json:"ip_address"`
	Aliases   []string `json:"aliases"`
}

// GenerateServiceAliases generates DNS aliases for a service
func GenerateServiceAliases(serviceName, projectSlug string) []string {
	aliases := []string{serviceName}

	if projectSlug != "" {
		aliases = append(aliases, fmt.Sprintf("%s.%s.local", serviceName, projectSlug))
	}

	return aliases
}
