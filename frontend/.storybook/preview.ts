import type { Preview } from "@storybook/react";
import "../src/app/globals.css";

const preview: Preview = {
  parameters: {
    controls: {
      matchers: {
        color: /(background|color)$/i,
        date: /Date$/i,
      },
    },
    backgrounds: {
      default: "evomap-dark",
      values: [
        { name: "evomap-dark", value: "#09090b" },
        { name: "evomap-light", value: "#fafafa" },
        { name: "twitter", value: "#15202b" },
      ],
    },
    layout: "padded",
  },
};

export default preview;
