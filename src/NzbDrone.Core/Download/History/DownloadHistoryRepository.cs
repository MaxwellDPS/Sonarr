using System.Collections.Generic;
using System.Linq;
using NzbDrone.Core.Datastore;
using NzbDrone.Core.Messaging.Events;

namespace NzbDrone.Core.Download.History
{
    public interface IDownloadHistoryRepository : IBasicRepository<DownloadHistory>
    {
        List<DownloadHistory> FindByDownloadId(string downloadId);
        List<DownloadHistory> FindGrabbedByDownloadClientId(int downloadClientId);
        void DeleteBySeriesIds(List<int> seriesIds);
    }

    public class DownloadHistoryRepository : BasicRepository<DownloadHistory>, IDownloadHistoryRepository
    {
        public DownloadHistoryRepository(IMainDatabase database, IEventAggregator eventAggregator)
            : base(database, eventAggregator)
        {
        }

        public List<DownloadHistory> FindByDownloadId(string downloadId)
        {
            return Query(h => h.DownloadId == downloadId).OrderByDescending(h => h.Date).ToList();
        }

        public List<DownloadHistory> FindGrabbedByDownloadClientId(int downloadClientId)
        {
            return Query(x => x.DownloadClientId == downloadClientId && x.EventType == DownloadHistoryEventType.DownloadGrabbed)
                .OrderByDescending(h => h.Date)
                .ToList();
        }

        public void DeleteBySeriesIds(List<int> seriesIds)
        {
            Delete(r => seriesIds.Contains(r.SeriesId));
        }
    }
}
