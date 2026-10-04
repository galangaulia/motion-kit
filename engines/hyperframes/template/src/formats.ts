// The film's frames, laid out at half size (540 on the short side) and rendered
// at 2× to 1080p. motion-hf builds one page per entry; motion-review --comp names one.
export const FORMATS = {
  Square: { width: 540, height: 540 },
  Vertical: { width: 540, height: 960 },
  Wide: { width: 960, height: 540 },
}
