// Physical formats are part of an illustration's identity. Width and height
// are in world units; one unit is a 250 px print at the framing plane.
export const replayPaperFormats=[
 [1.04,.98],[1,1.12],[1,1.2],[1.1,.96],[1.16,1.04],
 [1,1],[1,1.1],[1.1,1.04],[1,1],[1.04,1.04],
 [1.1,.9],[1.02,1.14],[1.04,1.04],[1,1],[.96,1.2],
 [1,1.22],[1,1.14],[1,1.18],[1,1],[1,1.08],[1.1,1.06]
];
export const replayPaperFormat=id=>replayPaperFormats[id]??[1,1.2];
