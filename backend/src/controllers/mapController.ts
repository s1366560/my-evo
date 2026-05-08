import { Request, Response } from 'express';
import crypto from 'crypto';
import prisma from '../db/prisma.js';

function generateMapNodeId(): string {
  const hash = crypto.createHash('sha256')
    .update(Date.now().toString() + Math.random().toString())
    .digest('hex')
    .substring(0, 12);
  return `mapn_${hash}`;
}

export class MapController {
  // GET /map/nodes - Get all map nodes
  async getNodes(req: Request, res: Response): Promise<void> {
    try {
      const { type, limit = 100, offset = 0 } = req.query;
      
      const where = type ? { type: type as string } : {};
      
      const nodesRaw = await prisma.mapNode.findMany({
        where,
        take: Number(limit),
        skip: Number(offset),
        orderBy: { createdAt: 'desc' },
      });
      
      // Parse JSON fields
      const nodes = nodesRaw.map(n => ({
        ...n,
        metadata: n.metadata ? JSON.parse(n.metadata) : null,
      }));
      
      const total = await prisma.mapNode.count({ where });
      
      res.json({
        nodes,
        total,
      });
    } catch (error) {
      console.error('Get map nodes error:', error);
      res.status(500).json({
        error: 'Internal Server Error',
        message: 'Failed to get map nodes',
      });
    }
  }
  
  // GET /map/edges - Get all map edges
  async getEdges(req: Request, res: Response): Promise<void> {
    try {
      const edges = await prisma.mapEdge.findMany();
      
      res.json({
        edges,
        count: edges.length,
      });
    } catch (error) {
      console.error('Get map edges error:', error);
      res.status(500).json({
        error: 'Internal Server Error',
        message: 'Failed to get map edges',
      });
    }
  }
  
  // GET /map/graph - Get full graph data (nodes + edges)
  async getGraph(req: Request, res: Response): Promise<void> {
    try {
      const nodes = await prisma.mapNode.findMany({
        orderBy: { createdAt: 'desc' },
      });
      
      const edges = await prisma.mapEdge.findMany();
      
      res.json({
        nodes,
        edges,
        nodeCount: nodes.length,
        edgeCount: edges.length,
      });
    } catch (error) {
      console.error('Get graph error:', error);
      res.status(500).json({
        error: 'Internal Server Error',
        message: 'Failed to get graph',
      });
    }
  }
  
  // POST /map/node - Create a map node
  async createNode(req: Request, res: Response): Promise<void> {
    try {
      const { name, type, positionX, positionY, size, color, metadata, parentId } = req.body;
      
      const mapNodeId = generateMapNodeId();
      
      const node = await prisma.mapNode.create({
        data: {
          mapNodeId,
          name,
          type,
          positionX: positionX || 0,
          positionY: positionY || 0,
          size: size || 1,
          color,
          metadata: metadata ? JSON.stringify(metadata) : null,
          parentId,
        },
      });
      
      res.status(201).json({
        map_node_id: node.mapNodeId,
        name: node.name,
        type: node.type,
        message: 'Map node created successfully',
      });
    } catch (error) {
      console.error('Create map node error:', error);
      res.status(500).json({
        error: 'Internal Server Error',
        message: 'Failed to create map node',
      });
    }
  }
  
  // PUT /map/node/:mapNodeId - Update a map node
  async updateNode(req: Request, res: Response): Promise<void> {
    try {
      const { mapNodeId } = req.params;
      const updates = req.body;
      
      // Remove fields that shouldn't be updated
      delete updates.id;
      delete updates.mapNodeId;
      delete updates.createdAt;
      
      const node = await prisma.mapNode.update({
        where: { mapNodeId },
        data: updates,
      });
      
      res.json({
        node,
        message: 'Map node updated successfully',
      });
    } catch (error) {
      console.error('Update map node error:', error);
      res.status(500).json({
        error: 'Internal Server Error',
        message: 'Failed to update map node',
      });
    }
  }
  
  // POST /map/edge - Create an edge
  async createEdge(req: Request, res: Response): Promise<void> {
    try {
      const { sourceId, targetId, type, weight } = req.body;
      
      // Verify nodes exist
      const sourceNode = await prisma.mapNode.findUnique({
        where: { mapNodeId: sourceId },
      });
      
      const targetNode = await prisma.mapNode.findUnique({
        where: { mapNodeId: targetId },
      });
      
      if (!sourceNode || !targetNode) {
        res.status(404).json({
          error: 'Not Found',
          message: 'Source or target node not found',
        });
        return;
      }
      
      const edge = await prisma.mapEdge.create({
        data: {
          sourceId: sourceNode.id,
          targetId: targetNode.id,
          type: type || 'reference',
          weight: weight || 1,
        },
      });
      
      res.status(201).json({
        edge_id: edge.id,
        source: sourceId,
        target: targetId,
        message: 'Edge created successfully',
      });
    } catch (error) {
      console.error('Create edge error:', error);
      res.status(500).json({
        error: 'Internal Server Error',
        message: 'Failed to create edge',
      });
    }
  }
  
  // DELETE /map/edge/:edgeId - Delete an edge
  async deleteEdge(req: Request, res: Response): Promise<void> {
    try {
      const { edgeId } = req.params;
      
      await prisma.mapEdge.delete({
        where: { id: edgeId },
      });
      
      res.json({
        message: 'Edge deleted successfully',
      });
    } catch (error) {
      console.error('Delete edge error:', error);
      res.status(500).json({
        error: 'Internal Server Error',
        message: 'Failed to delete edge',
      });
    }
  }
  
  // POST /map/save - Save map data (nodes + edges + config) - OVERLOADED METHOD
  async saveMap(req: Request, res: Response): Promise<void> {
    // This method handles both anonymous and authenticated saves
    // If user is authenticated, save to SavedMap
    // Otherwise, just save nodes and edges to mapNode/mapEdge tables
    try {
      const { nodes, edges, config, name, description } = req.body;

      if (!nodes || !Array.isArray(nodes)) {
        res.status(400).json({
          error: 'Bad Request',
          message: 'Invalid map data: nodes array is required',
        });
        return;
      }

      // Save each node
      const savedNodes = [];
      for (const node of nodes) {
        const existingNode = await prisma.mapNode.findFirst({
          where: { name: node.name || node.label },
        });

        if (existingNode) {
          // Update existing node
          const updated = await prisma.mapNode.update({
            where: { id: existingNode.id },
            data: {
              positionX: node.x ?? existingNode.positionX,
              positionY: node.y ?? existingNode.positionY,
              size: node.score ?? existingNode.size,
              color: node.color || existingNode.color,
              metadata: JSON.stringify({
                ...(existingNode.metadata ? JSON.parse(existingNode.metadata) : {}),
                label: node.label,
                type: node.type,
                score: node.score,
                ...node.metadata,
              }),
            },
          });
          savedNodes.push(updated);
        } else {
          // Create new node
          const mapNodeId = generateMapNodeId();
          const created = await prisma.mapNode.create({
            data: {
              mapNodeId,
              name: node.name || node.label || `node_${Date.now()}`,
              type: node.type || 'gene',
              positionX: node.x || 0,
              positionY: node.y || 0,
              size: node.score || 1,
              color: node.color,
              metadata: JSON.stringify({
                label: node.label,
                type: node.type,
                score: node.score,
                ...node.metadata,
              }),
            },
          });
          savedNodes.push(created);
        }
      }

      // Save edges
      const savedEdges = [];
      if (edges && Array.isArray(edges)) {
        for (const edge of edges) {
          const sourceNode = savedNodes.find(n => n.name === edge.source || n.mapNodeId === edge.source);
          const targetNode = savedNodes.find(n => n.name === edge.target || n.mapNodeId === edge.target);

          if (sourceNode && targetNode) {
            const existingEdge = await prisma.mapEdge.findFirst({
              where: {
                sourceId: sourceNode.id,
                targetId: targetNode.id,
              },
            });

            if (!existingEdge) {
              const created = await prisma.mapEdge.create({
                data: {
                  sourceId: sourceNode.id,
                  targetId: targetNode.id,
                  type: edge.type || 'reference',
                  weight: edge.strength || edge.weight || 1,
                },
              });
              savedEdges.push(created);
            } else {
              savedEdges.push(existingEdge);
            }
          }
        }
      }

      // If user is authenticated, also save to SavedMap
      let savedMapInfo = null;
      if (req.user && name) {
        const mapId = `map_${Date.now()}_${Math.random().toString(36).substring(2, 8)}`;
        const savedMap = await prisma.savedMap.create({
          data: {
            mapId,
            name,
            description: description || null,
            config: JSON.stringify(config || {}),
            nodes: JSON.stringify(nodes),
            edges: JSON.stringify(edges),
            userId: req.user.userId,
            isPublic: false,
          },
        });
        savedMapInfo = { map_id: savedMap.mapId, name: savedMap.name };
      }

      res.status(200).json({
        message: 'Map saved successfully',
        nodes: savedNodes.length,
        edges: savedEdges.length,
        ...(savedMapInfo && { savedMap: savedMapInfo }),
      });
    } catch (error) {
      console.error('Save map error:', error);
      res.status(500).json({
        error: 'Internal Server Error',
        message: 'Failed to save map',
      });
    }
  }

  // POST /map/sync - Sync map with assets
  async syncWithAssets(req: Request, res: Response): Promise<void> {
    try {
      // Get all published assets
      const assets = await prisma.asset.findMany({
        where: { status: 'PUBLISHED' },
        select: {
          assetId: true,
          type: true,
          name: true,
          parentId: true,
        },
      });
      
      // Create or update map nodes for each asset
      for (const asset of assets) {
        const existing = await prisma.mapNode.findFirst({
          where: { name: asset.name },
        });
        
        if (!existing) {
          // Calculate position based on type
          const positionY = asset.type === 'GENE' ? 0.5 : 0.7;
          const positionX = Math.random();
          
          await prisma.mapNode.create({
            data: {
              mapNodeId: `mapn_${asset.assetId}`,
              name: asset.name,
              type: asset.type.toLowerCase(),
              positionX,
              positionY,
              size: 1,
              metadata: JSON.stringify({
                assetId: asset.assetId,
                parentId: asset.parentId,
              }),
              parentId: asset.parentId ? `mapn_${asset.parentId}` : null,
            },
          });
        }
      }
      
      // Create inheritance edges
      for (const asset of assets) {
        if (asset.parentId) {
          const parentNode = await prisma.mapNode.findFirst({
            where: { name: { contains: asset.parentId } },
          });
          
          const childNode = await prisma.mapNode.findFirst({
            where: { name: asset.name },
          });
          
          if (parentNode && childNode) {
            const existingEdge = await prisma.mapEdge.findFirst({
              where: {
                sourceId: parentNode.id,
                targetId: childNode.id,
              },
            });
            
            if (!existingEdge) {
              await prisma.mapEdge.create({
                data: {
                  sourceId: parentNode.id,
                  targetId: childNode.id,
                  type: 'inheritance',
                  weight: 1,
                },
              });
            }
          }
        }
      }
      
      res.json({
        message: 'Map synced with assets successfully',
        syncedAssets: assets.length,
      });
    } catch (error) {
      console.error('Sync map error:', error);
      res.status(500).json({
        error: 'Internal Server Error',
        message: 'Failed to sync map',
      });
    }
  }

  // GET /map/saved - Get user's saved maps (authenticated)
  async getSavedMaps(req: Request, res: Response): Promise<void> {
    try {
      if (!req.user) {
        res.status(401).json({ error: 'Unauthorized', message: 'Login required' });
        return;
      }

      const savedMaps = await prisma.savedMap.findMany({
        where: { userId: req.user.userId },
        orderBy: { updatedAt: 'desc' },
        select: { mapId: true, name: true, description: true, isPublic: true, createdAt: true, updatedAt: true },
      });

      res.json({ maps: savedMaps, count: savedMaps.length });
    } catch (error) {
      console.error('Get saved maps error:', error);
      res.status(500).json({ error: 'Internal Server Error', message: 'Failed to get saved maps' });
    }
  }

  // GET /map/saved/:mapId - Get a specific saved map
  async getSavedMap(req: Request, res: Response): Promise<void> {
    try {
      if (!req.user) {
        res.status(401).json({ error: 'Unauthorized', message: 'Login required' });
        return;
      }

      const { mapId } = req.params;

      const savedMap = await prisma.savedMap.findUnique({ where: { mapId } });

      if (!savedMap) {
        res.status(404).json({ error: 'Not Found', message: 'Map not found' });
        return;
      }

      if (savedMap.userId !== req.user.userId && !savedMap.isPublic) {
        res.status(403).json({ error: 'Forbidden', message: 'Access denied' });
        return;
      }

      res.json({
        map: {
          mapId: savedMap.mapId,
          name: savedMap.name,
          description: savedMap.description,
          config: JSON.parse(savedMap.config),
          nodes: JSON.parse(savedMap.nodes),
          edges: JSON.parse(savedMap.edges),
          isPublic: savedMap.isPublic,
          createdAt: savedMap.createdAt,
          updatedAt: savedMap.updatedAt,
        },
      });
    } catch (error) {
      console.error('Get saved map error:', error);
      res.status(500).json({ error: 'Internal Server Error', message: 'Failed to get saved map' });
    }
  }

  // PUT /map/saved/:mapId - Update a saved map
  async updateSavedMap(req: Request, res: Response): Promise<void> {
    try {
      if (!req.user) {
        res.status(401).json({ error: 'Unauthorized', message: 'Login required' });
        return;
      }

      const { mapId } = req.params;
      const { name, description, config, nodes, edges, isPublic } = req.body;

      const existingMap = await prisma.savedMap.findUnique({ where: { mapId } });

      if (!existingMap) {
        res.status(404).json({ error: 'Not Found', message: 'Map not found' });
        return;
      }

      if (existingMap.userId !== req.user.userId) {
        res.status(403).json({ error: 'Forbidden', message: 'Access denied' });
        return;
      }

      const updatedMap = await prisma.savedMap.update({
        where: { mapId },
        data: {
          name: name || existingMap.name,
          description: description !== undefined ? description : existingMap.description,
          config: config ? JSON.stringify(config) : existingMap.config,
          nodes: nodes ? JSON.stringify(nodes) : existingMap.nodes,
          edges: edges ? JSON.stringify(edges) : existingMap.edges,
          isPublic: isPublic !== undefined ? isPublic : existingMap.isPublic,
        },
      });

      res.json({ map_id: updatedMap.mapId, name: updatedMap.name, message: 'Map updated successfully' });
    } catch (error) {
      console.error('Update saved map error:', error);
      res.status(500).json({ error: 'Internal Server Error', message: 'Failed to update saved map' });
    }
  }

  // DELETE /map/saved/:mapId - Delete a saved map
  async deleteSavedMap(req: Request, res: Response): Promise<void> {
    try {
      if (!req.user) {
        res.status(401).json({ error: 'Unauthorized', message: 'Login required' });
        return;
      }

      const { mapId } = req.params;

      const existingMap = await prisma.savedMap.findUnique({ where: { mapId } });

      if (!existingMap) {
        res.status(404).json({ error: 'Not Found', message: 'Map not found' });
        return;
      }

      if (existingMap.userId !== req.user.userId) {
        res.status(403).json({ error: 'Forbidden', message: 'Access denied' });
        return;
      }

      await prisma.savedMap.delete({ where: { mapId } });

      res.json({ message: 'Map deleted successfully' });
    } catch (error) {
      console.error('Delete saved map error:', error);
      res.status(500).json({ error: 'Internal Server Error', message: 'Failed to delete saved map' });
    }
  }
}

export const mapController = new MapController();
