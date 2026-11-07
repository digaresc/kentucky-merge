// ASCII art for the Hippodrome. Keep every frame the same width/height so nothing jitters.

export const HORSE_FRAMES = [
  [
    "            _~^~ ",
    "  ___.----./  o \\",
    " /(           ._/",
    "/ )\\__)-~(__./   ",
    "   / |    | \\    ",
  ],
  [
    "            _~^~ ",
    "  ___.----./  o \\",
    " /(           ._/",
    "/ )\\__)-~(__./   ",
    "  \\ \\      / /   ",
  ],
];

export const HORSE_WIDTH_CH = 18;

// Sir Nitpicksalot's great helm; the visor and monocle move while he talks.
export const KNIGHT_FRAMES = {
  idle: [
    "     ,/\\,     ",
    "  __//  \\\\__  ",
    " /  ______  \\ ",
    "|  |=(o)==|  |",
    "|  |__||__|  |",
    " \\    ||    / ",
    "  \\___||___/  ",
  ],
  talkA: [
    "     ,/\\,     ",
    "  __//  \\\\__  ",
    " /  ______  \\ ",
    "|  |=(O)--|  |",
    "|  |_-||-_|  |",
    " \\    ||    / ",
    "  \\___||___/  ",
  ],
  talkB: [
    "     ,/\\,     ",
    "  __//  \\\\__  ",
    " /  ______  \\ ",
    "|  |-(o)==|  |",
    "|  |-_||_-|  |",
    " \\    ||    / ",
    "  \\___||___/  ",
  ],
};
