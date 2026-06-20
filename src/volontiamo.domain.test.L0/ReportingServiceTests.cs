using volontiamo.domain;

namespace volontiamo.domain.test.L0;

public class ReportingServiceTests
{
    [Fact]
    public async Task GetSummaryAsync_ComputesHoursEventsAndContributorsFromAcceptedParticipations()
    {
        var volunteerOneId = Guid.NewGuid();
        var volunteerTwoId = Guid.NewGuid();
        var repository = new FakeReportingRepository
        {
            Dataset = new ReportingDataset(
                [
                    new ReportingEventContribution(TimeSpan.FromHours(4), 2),
                    new ReportingEventContribution(TimeSpan.FromHours(2.5), 1),
                    new ReportingEventContribution(TimeSpan.FromHours(3), 0)
                ],
                [
                    new ReportingVolunteerSnapshot(volunteerOneId, "Mario", "Rossi", 6.5m, 2),
                    new ReportingVolunteerSnapshot(volunteerTwoId, "Anna", "Bianchi", 4m, 1),
                    new ReportingVolunteerSnapshot(Guid.NewGuid(), "Luca", "Verdi", 0m, 0)
                ])
        };
        var service = new ReportingService(repository);

        var result = await service.GetSummaryAsync(new ReportingSummaryRequest(Utc(2026, 1, 1), Utc(2026, 12, 31)));

        Assert.Equal(ResultStatus.Ok, result.Status);
        Assert.NotNull(result.Value);
        Assert.Equal(10.5m, result.Value!.TotalHours);
        Assert.Equal(3, result.Value.ConcludedEventsCount);
        Assert.Equal(2, result.Value.VolunteersCount);
        Assert.Equal(Utc(2026, 1, 1), repository.LastFilter!.FromUtc);
        Assert.Equal(Utc(2026, 12, 31), repository.LastFilter.ToUtc);
    }

    [Fact]
    public async Task GetSummaryAsync_WhenFilterDatesAreInvalid_ReturnsValidationError()
    {
        var service = new ReportingService(new FakeReportingRepository());

        var result = await service.GetSummaryAsync(new ReportingSummaryRequest(
            new DateTime(2026, 1, 1, 0, 0, 0, DateTimeKind.Unspecified),
            Utc(2025, 12, 31)));

        Assert.Equal(ResultStatus.ValidationError, result.Status);
        Assert.Contains(result.Errors, error => error.Field == "from");
    }

    [Fact]
    public async Task GetLeaderboardAsync_NormalizesPaginationAndOrdersByHoursThenEventsThenName()
    {
        var alphaId = Guid.NewGuid();
        var betaId = Guid.NewGuid();
        var gammaId = Guid.NewGuid();
        var repository = new FakeReportingRepository
        {
            Dataset = new ReportingDataset(
                [],
                [
                    new ReportingVolunteerSnapshot(alphaId, "Mario", "Rossi", 8m, 2),
                    new ReportingVolunteerSnapshot(betaId, "Anna", "Bianchi", 8m, 3),
                    new ReportingVolunteerSnapshot(gammaId, "Luca", "Verdi", 2m, 1),
                    new ReportingVolunteerSnapshot(Guid.NewGuid(), "Zero", "Ore", 0m, 0)
                ])
        };
        var service = new ReportingService(repository);

        var result = await service.GetLeaderboardAsync(new ReportingLeaderboardRequest(null, null, Page: 0, PageSize: 999));

        Assert.Equal(ResultStatus.Ok, result.Status);
        Assert.NotNull(result.Value);
        Assert.Equal(1, result.Value!.Page);
        Assert.Equal(100, result.Value.PageSize);
        Assert.Equal(3, result.Value.TotalCount);
        Assert.Equal([betaId, alphaId, gammaId], result.Value.Items.Select(item => item.UserId).ToArray());
    }

    [Fact]
    public async Task GetVolunteerOverviewAsync_ReturnsRankAcrossAllVolunteers()
    {
        var currentUserId = Guid.NewGuid();
        var repository = new FakeReportingRepository
        {
            Dataset = new ReportingDataset(
                [],
                [
                    new ReportingVolunteerSnapshot(Guid.NewGuid(), "Anna", "Bianchi", 10m, 3),
                    new ReportingVolunteerSnapshot(currentUserId, "Mario", "Rossi", 6m, 2),
                    new ReportingVolunteerSnapshot(Guid.NewGuid(), "Luca", "Verdi", 0m, 0)
                ])
        };
        var service = new ReportingService(repository);

        var result = await service.GetVolunteerOverviewAsync(currentUserId);

        Assert.Equal(ResultStatus.Ok, result.Status);
        Assert.NotNull(result.Value);
        Assert.Equal(6m, result.Value!.TotalHours);
        Assert.Equal(2, result.Value.ParticipatedEventsCount);
        Assert.Equal(2, result.Value.Rank);
        Assert.Equal(3, result.Value.TotalVolunteers);
    }

    [Fact]
    public async Task GetVolunteerOverviewAsync_WhenVolunteerIsMissing_ReturnsNotFound()
    {
        var service = new ReportingService(new FakeReportingRepository
        {
            Dataset = new ReportingDataset([], [])
        });

        var result = await service.GetVolunteerOverviewAsync(Guid.NewGuid());

        Assert.Equal(ResultStatus.NotFound, result.Status);
    }

    private static DateTime Utc(int year, int month, int day)
        => new(year, month, day, 0, 0, 0, DateTimeKind.Utc);

    private sealed class FakeReportingRepository : IReportingRepository
    {
        public ReportingDataset Dataset { get; set; } = new([], []);
        public ReportingFilter? LastFilter { get; private set; }

        public Task<ReportingDataset> GetDatasetAsync(ReportingFilter filter, CancellationToken ct = default)
        {
            LastFilter = filter;
            return Task.FromResult(Dataset);
        }
    }
}