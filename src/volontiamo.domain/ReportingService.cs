namespace volontiamo.domain;

public record ReportingFilter(DateTime? FromUtc, DateTime? ToUtc);

public record ReportingEventContribution(TimeSpan Duration, int ConfirmedParticipantsCount);

public record ReportingVolunteerSnapshot(
    Guid UserId,
    string FirstName,
    string LastName,
    decimal TotalHours,
    int ParticipatedEventsCount);

public record ReportingDataset(
    IReadOnlyList<ReportingEventContribution> EventContributions,
    IReadOnlyList<ReportingVolunteerSnapshot> VolunteerTotals);

public record ReportingSummaryRequest(DateTime? FromUtc, DateTime? ToUtc);

public record ReportingSummaryResponse(decimal TotalHours, int ConcludedEventsCount, int VolunteersCount);

public record ReportingLeaderboardRequest(DateTime? FromUtc, DateTime? ToUtc, int Page, int PageSize);

public record ReportingLeaderboardEntryResponse(
    Guid UserId,
    string FirstName,
    string LastName,
    decimal TotalHours,
    int ParticipatedEventsCount);

public record VolunteerReportingResponse(
    decimal TotalHours,
    int ParticipatedEventsCount,
    int Rank,
    int TotalVolunteers);

public interface IReportingRepository
{
    Task<ReportingDataset> GetDatasetAsync(ReportingFilter filter, CancellationToken ct = default);
}

public sealed class ReportingService
{
    private readonly IReportingRepository _repository;

    public ReportingService(IReportingRepository repository)
    {
        _repository = repository;
    }

    public async Task<Result<ReportingSummaryResponse>> GetSummaryAsync(ReportingSummaryRequest request, CancellationToken ct = default)
    {
        var validationErrors = ValidateFilter(request.FromUtc, request.ToUtc);
        if (validationErrors.Count > 0)
            return Result<ReportingSummaryResponse>.ValidationFailure(validationErrors);

        var dataset = await _repository.GetDatasetAsync(new ReportingFilter(request.FromUtc, request.ToUtc), ct);
        return Result<ReportingSummaryResponse>.Success(CreateSummary(dataset));
    }

    public async Task<Result<PagedResponse<ReportingLeaderboardEntryResponse>>> GetLeaderboardAsync(ReportingLeaderboardRequest request, CancellationToken ct = default)
    {
        var validationErrors = ValidateFilter(request.FromUtc, request.ToUtc);
        if (validationErrors.Count > 0)
            return Result<PagedResponse<ReportingLeaderboardEntryResponse>>.ValidationFailure(validationErrors);

        var page = request.Page < 1 ? 1 : request.Page;
        var pageSize = request.PageSize < 1 ? 10 : request.PageSize;
        if (pageSize > 100) pageSize = 100;

        var dataset = await _repository.GetDatasetAsync(new ReportingFilter(request.FromUtc, request.ToUtc), ct);
        var ordered = OrderVolunteerTotals(dataset.VolunteerTotals.Where(HasReportedActivity).ToList());
        var items = ordered
            .Skip((page - 1) * pageSize)
            .Take(pageSize)
            .Select(MapLeaderboardEntry)
            .ToList();

        var response = new PagedResponse<ReportingLeaderboardEntryResponse>(items, page, pageSize, ordered.Count);
        return Result<PagedResponse<ReportingLeaderboardEntryResponse>>.Success(response);
    }

    public async Task<Result<VolunteerReportingResponse>> GetVolunteerOverviewAsync(Guid userId, CancellationToken ct = default)
    {
        var dataset = await _repository.GetDatasetAsync(new ReportingFilter(null, null), ct);
        var ordered = OrderVolunteerTotals(dataset.VolunteerTotals);
        var index = ordered.FindIndex(item => item.UserId == userId);
        if (index < 0)
            return Result<VolunteerReportingResponse>.NotFound();

        var volunteer = ordered[index];
        var response = new VolunteerReportingResponse(
            volunteer.TotalHours,
            volunteer.ParticipatedEventsCount,
            index + 1,
            ordered.Count);

        return Result<VolunteerReportingResponse>.Success(response);
    }

    private static ReportingSummaryResponse CreateSummary(ReportingDataset dataset)
    {
        var totalHours = dataset.EventContributions.Sum(item => RoundHours(item.Duration, item.ConfirmedParticipantsCount));
        var concludedEventsCount = dataset.EventContributions.Count;
        var volunteersCount = dataset.VolunteerTotals.Count(item => item.TotalHours > 0);
        return new ReportingSummaryResponse(totalHours, concludedEventsCount, volunteersCount);
    }

    private static decimal RoundHours(TimeSpan duration, int confirmedParticipantsCount)
    {
        if (confirmedParticipantsCount <= 0)
            return 0m;

        return (decimal)duration.TotalHours * confirmedParticipantsCount;
    }

    private static List<ReportingVolunteerSnapshot> OrderVolunteerTotals(IReadOnlyList<ReportingVolunteerSnapshot> volunteerTotals)
    {
        return volunteerTotals
            .OrderByDescending(item => item.TotalHours)
            .ThenByDescending(item => item.ParticipatedEventsCount)
            .ThenBy(item => item.LastName, StringComparer.OrdinalIgnoreCase)
            .ThenBy(item => item.FirstName, StringComparer.OrdinalIgnoreCase)
            .ThenBy(item => item.UserId)
            .ToList();
    }

    private static ReportingLeaderboardEntryResponse MapLeaderboardEntry(ReportingVolunteerSnapshot item)
    {
        return new ReportingLeaderboardEntryResponse(
            item.UserId,
            item.FirstName,
            item.LastName,
            item.TotalHours,
            item.ParticipatedEventsCount);
    }

    private static bool HasReportedActivity(ReportingVolunteerSnapshot item)
        => item.TotalHours > 0 || item.ParticipatedEventsCount > 0;

    private static List<ValidationError> ValidateFilter(DateTime? fromUtc, DateTime? toUtc)
    {
        var errors = new List<ValidationError>();

        if (fromUtc.HasValue && fromUtc.Value.Kind != DateTimeKind.Utc)
            errors.Add(new ValidationError("from", "From date must be UTC."));

        if (toUtc.HasValue && toUtc.Value.Kind != DateTimeKind.Utc)
            errors.Add(new ValidationError("to", "To date must be UTC."));

        if (fromUtc.HasValue && toUtc.HasValue && toUtc.Value < fromUtc.Value)
            errors.Add(new ValidationError("to", "To date cannot be earlier than from date."));

        return errors;
    }
}