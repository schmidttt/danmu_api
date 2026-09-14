import BaseSource from '../danmu_api/sources/base.js';
import { SegmentListResponse } from '../danmu_api/models/dandan-model.js';

// Build-only replacement: server uploads are not accessible to a standalone widget.
export default class LocalSource extends BaseSource {
  async search() { return []; }
  async handleAnimes() { return []; }
  async getEpisodeDanmu() { return []; }
  formatComments(comments) { return comments; }
  async getEpisodeDanmuSegments() {
    return new SegmentListResponse({ type: 'local', segmentList: [] });
  }
  async getEpisodeSegmentDanmu() { return []; }
}
