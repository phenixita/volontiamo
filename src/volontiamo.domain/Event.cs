namespace volontiamo.domain;

public enum EventStatus
{
    Draft = 0,
    Active = 1,
    Concluded = 2
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

    public void SoftDelete()
    {
        IsDeleted = true;
        UpdatedAt = DateTime.UtcNow;
    }
}