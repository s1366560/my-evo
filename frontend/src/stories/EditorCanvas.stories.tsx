import type { Meta, StoryObj } from "@storybook/react";
import { MapCanvas } from "@/components/editor/MapCanvas";

const meta: Meta<typeof MapCanvas> = {
  title: "Editor/MapCanvas",
  component: MapCanvas,
  tags: ["autodocs"],
  parameters: {
    layout: "fullscreen",
  },
};

export default meta;
type Story = StoryObj<typeof MapCanvas>;

export const Default: Story = {
  args: {
    mapId: "default",
    onNodeDoubleClick: (nodeId: string) => console.log("Edit node:", nodeId),
  },
};

export const WithAiGenerate: Story = {
  args: {
    mapId: "ai-demo",
    onNodeDoubleClick: (nodeId: string) => console.log("Edit node:", nodeId),
  },
};
