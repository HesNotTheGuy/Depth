// Depth Figma Plugin — main thread
// Hosts the Depth web editor in a UI iframe, receives the exported PNG,
// and inserts it as an image node at the viewport center.

figma.showUI(__html__, {
  width: 1200,
  height: 800,
  title: 'Depth — 3D Mockups',
});

// Figma plugin UIs are resizable when the plugin calls figma.ui.resize.
// We expose a simple message protocol so the UI can tell us to resize too,
// but default dimensions are 1200x800.

interface InsertImageMessage {
  type: 'insert-image';
  bytes: Uint8Array;
  width: number;
  height: number;
}

interface CloseMessage {
  type: 'close';
}

interface ResizeMessage {
  type: 'resize';
  width: number;
  height: number;
}

type PluginMessage = InsertImageMessage | CloseMessage | ResizeMessage;

figma.ui.onmessage = async (msg: PluginMessage) => {
  if (msg.type === 'close') {
    figma.closePlugin();
    return;
  }

  if (msg.type === 'resize') {
    figma.ui.resize(Math.max(400, msg.width), Math.max(300, msg.height));
    return;
  }

  if (msg.type === 'insert-image') {
    try {
      const image = figma.createImage(msg.bytes);
      const node = figma.createRectangle();
      node.name = 'Depth Mockup';
      node.resize(msg.width, msg.height);
      node.fills = [
        {
          type: 'IMAGE',
          scaleMode: 'FILL',
          imageHash: image.hash,
        },
      ];

      // Center on current viewport.
      const { center } = figma.viewport;
      node.x = Math.round(center.x - msg.width / 2);
      node.y = Math.round(center.y - msg.height / 2);

      figma.currentPage.appendChild(node);
      figma.currentPage.selection = [node];
      figma.viewport.scrollAndZoomIntoView([node]);

      figma.notify('Depth mockup inserted');
      figma.closePlugin();
    } catch (err) {
      console.error('[Depth] insert-image failed', err);
      figma.notify('Failed to insert Depth mockup', { error: true });
    }
  }
};
