namespace volontiamo.domain;

public enum NotificationKind
{
    EventCreated = 0
}

public class Notification
{
    public Guid Id { get; private set; }
    public Guid UserId { get; private set; }
    public NotificationKind Kind { get; private set; }
    public string Title { get; private set; } = default!;
    public string Body { get; private set; } = default!;
    public int EventId { get; private set; }
    public Event Event { get; private set; } = default!;
    public DateTime CreatedAt { get; private set; }
    public DateTime? ReadAt { get; private set; }

    private Notification() { }

    public static Notification CreateEventCreated(Guid userId, Event eventItem, DateTime nowUtc)
    {
        return new Notification
        {
            Id = Guid.NewGuid(),
            UserId = userId,
            Kind = NotificationKind.EventCreated,
            Title = eventItem.Name,
            Body = BuildEventCreatedBody(eventItem),
            EventId = eventItem.Id,
            Event = eventItem,
            CreatedAt = nowUtc
        };
    }

    public void MarkAsRead(DateTime nowUtc)
    {
        if (ReadAt is not null)
            return;

        ReadAt = nowUtc;
    }

    private static string BuildEventCreatedBody(Event eventItem)
    {
        var when = $"{eventItem.StartAtUtc:dd/MM/yyyy} alle {eventItem.StartAtUtc:HH:mm}";
        return string.IsNullOrWhiteSpace(eventItem.Location)
            ? $"Nuovo evento disponibile il {when}."
            : $"Nuovo evento disponibile il {when} presso {eventItem.Location}.";
    }
}
