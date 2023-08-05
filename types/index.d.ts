interface Config {
  string: string;
  publishEmbed?: boolean;
  languages: string[];
  truncate?: boolean;
  runInterval: number;
  dateField?: string;
}

interface Item {
  title: string;
  link: {
    href: string;
  };
  published?: string;
  pubdate?: string;
  description: string;
}

interface ParseResult {
  text: string;
}

interface Embed {
  uri: string;
  title: string;
  description?: string;
  image?: Buffer;
}

interface QueueItems {
  content: string;
  embed: Embed | undefined;
  languages: string[] | undefined;
  title: string;
  date: Date;
}
