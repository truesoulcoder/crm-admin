import { Mark, mergeAttributes } from '@tiptap/core';

export interface LinkOptions {
  openOnClick: boolean;
  HTMLAttributes: Record<string, any>;
}

const Link = Mark.create<LinkOptions>({
  name: 'link',

  addOptions() {
    return {
      openOnClick: true,
      HTMLAttributes: {},
    };
  },

  addAttributes() {
    return {
      href: {
        default: null,
      },
      target: {
        default: '_blank',
      },
      rel: {
        default: 'noopener noreferrer',
      },
    };
  },

  parseHTML() {
    return [
      {
        tag: 'a[href]'
      },
    ];
  },

  renderHTML({ HTMLAttributes }) {
    return ['a', mergeAttributes(this.options.HTMLAttributes, HTMLAttributes), 0];
  },

  addCommands() {
    return {
      setLink: attributes => ({ commands }) => {
        return commands.setMark('link', attributes);
      },
      unsetLink: () => ({ commands }) => {
        return commands.unsetMark('link');
      },
    };
  },

  addKeyboardShortcuts() {
    return {
      'Mod-k': () => {
        const href = window.prompt('Enter URL');
        if (href) {
          this.editor.chain().focus().setLink({ href }).run();
        }
        return true;
      },
    };
  },
});

export default Link;
