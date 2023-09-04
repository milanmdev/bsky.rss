interface Config {
  string: string;
  publishEmbed?: boolean;
  embedType?: string;
  languages: string[];
  truncate?: boolean;
  runInterval: number;
  dateField?: string;
  imageField?: string;
  ogUserAgent: string;
  descriptionClearHTML?: boolean;
  forceDescriptionEmbed?: boolean;
  imageAlt?: string;
}

interface Item {
  title: string;
  link: {
    href: string;
  };
  published?: string;
  pubdate?: string;
  description: string;
  [key: string]: any;
}

interface ParseResult {
  text: string;
}

interface Embed {
  uri: string;
  title: string;
  description?: string;
  image?: Buffer;
  imageAlt?: string;
  type?: string;
}

interface QueueItems {
  content: string;
  embed: Embed | undefined;
  languages: string[] | undefined;
  title: string;
  date: Date;
}
