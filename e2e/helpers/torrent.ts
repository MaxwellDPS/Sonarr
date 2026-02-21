// Sintel trailer - small (~6MB), Creative Commons, well-seeded via WebTorrent
// This is a commonly used test torrent in the WebTorrent ecosystem

export const TEST_TORRENT = {
  // Sintel trailer (short film by the Blender Foundation)
  magnetLink:
    'magnet:?xt=urn:btih:08ada5a7a6183aae1e09d831df6748d566095a10&dn=Sintel&tr=udp%3A%2F%2Fexplodie.org%3A6969&tr=udp%3A%2F%2Ftracker.coppersurfer.tk%3A6969&tr=udp%3A%2F%2Ftracker.empire-js.us%3A1337&tr=udp%3A%2F%2Ftracker.leechers-paradise.org%3A6969&tr=udp%3A%2F%2Ftracker.opentrackr.org%3A1337&tr=wss%3A%2F%2Ftracker.btorrent.xyz&tr=wss%3A%2F%2Ftracker.fastcast.nz&tr=wss%3A%2F%2Ftracker.openwebtorrent.com',
  expectedHash: '08ada5a7a6183aae1e09d831df6748d566095a10',
  expectedName: 'Sintel',
  expectedSizeApproxMB: 6,
};

// Release info for pushing to Sonarr as if it's a TV episode
// Size is reported as 200MB to pass Sonarr's minimum size check for 25min episodes
export function makeTestRelease(seriesTitle: string) {
  return {
    title: `${seriesTitle}.S01E01.${TEST_TORRENT.expectedName}.720p.WEB-DL`,
    magnetUrl: TEST_TORRENT.magnetLink,
    protocol: 'torrent' as const,
    publishDate: new Date().toISOString(),
    size: 200 * 1024 * 1024, // 200MB reported to pass quality size check
  };
}
