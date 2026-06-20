namespace volontiamo.domain;

public enum EventStatus
{
    Draft = 0,
    Active = 1,
    Concluded = 2
}

public enum EventParticipationStatus
{
    Candidata = 0,
    Partecipa = 1,
    Rifiutata = 2,
    NonInteressata = 3
}

public class Event
{
    public int Id { get; private set; }
    public string Name { get; private set; } = default!;
    public DateTime StartAtUtc { get; private set; }
    public DateTime EndAtUtc { get; private set; }
    public string? Location { get; private set; }
    public string OperationalNotesMarkdown { get; private set; } = default!;
    public EventStatus Status { get; private set; }
    public bool IsDeleted { get; private set; }
    public DateTime CreatedAt { get; private set; }
    public DateTime UpdatedAt { get; private set; }

    private Event() { }

    public static Event Create(
        string name,
        DateTime startAtUtc,
        DateTime endAtUtc,
        string? location,
        string? operationalNotesMarkdown,
        EventStatus status)
    {
        var now = DateTime.UtcNow;
        return new Event
        {
            Name = name.Trim(),
            StartAtUtc = startAtUtc,
            EndAtUtc = endAtUtc,
            Location = string.IsNullOrWhiteSpace(location) ? null : location.Trim(),
            OperationalNotesMarkdown = operationalNotesMarkdown ?? string.Empty,
            Status = status,
            IsDeleted = false,
            CreatedAt = now,
            UpdatedAt = now
        };
    }

    public void Update(
        string name,
        DateTime startAtUtc,
        DateTime endAtUtc,
        string? location,
        string? operationalNotesMarkdown,
        EventStatus status)
    {
        Name = name.Trim();
        StartAtUtc = startAtUtc;
        EndAtUtc = endAtUtc;
        Location = string.IsNullOrWhiteSpace(location) ? null : location.Trim();
        OperationalNotesMarkdown = operationalNotesMarkdown ?? string.Empty;
        Status = status;
        UpdatedAt = DateTime.UtcNow;
    }

    public void SoftDelete()
    {
        IsDeleted = true;
        UpdatedAt = DateTime.UtcNow;
    }
}

public class EventParticipation
{
    public int EventId { get; private set; }
    public Guid UserId { get; private set; }
    public EventParticipationStatus Status { get; private set; }
    public DateTime CreatedAt { get; private set; }
    public DateTime UpdatedAt { get; private set; }

    private EventParticipation() { }

    public static EventParticipation Create(
        int eventId,
        Guid userId,
        EventParticipationStatus status,
        DateTime nowUtc)
    {
        return new EventParticipation
        {
            EventId = eventId,
            UserId = userId,
            Status = status,
            CreatedAt = nowUtc,
            UpdatedAt = nowUtc
        };
    }

    public void ChangeStatus(EventParticipationStatus status, DateTime nowUtc)
    {
        Status = status;
        UpdatedAt = nowUtc;
    }
}