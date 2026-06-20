using System.Data;
using System.Data.Common;
using Microsoft.EntityFrameworkCore;
using Npgsql;
using volontiamo.domain;

namespace volontiamo.api.Persistence;

public sealed class ReportingRepository : IReportingRepository
{
    private readonly AppDbContext _db;

    public ReportingRepository(AppDbContext db)
    {
        _db = db;
    }

    public async Task<ReportingDataset> GetDatasetAsync(ReportingFilter filter, CancellationToken ct = default)
    {
        await _db.Database.OpenConnectionAsync(ct);

        try
        {
            var eventContributions = await ReadEventContributionsAsync(filter, ct);
            var volunteerTotals = await ReadVolunteerTotalsAsync(filter, ct);
            return new ReportingDataset(eventContributions, volunteerTotals);
        }
        finally
        {
            await _db.Database.CloseConnectionAsync();
        }
    }

    private async Task<IReadOnlyList<ReportingEventContribution>> ReadEventContributionsAsync(ReportingFilter filter, CancellationToken ct)
    {
        var connection = _db.Database.GetDbConnection();
        await using var command = connection.CreateCommand();
        command.CommandText = """
            SELECT
                COALESCE(EXTRACT(EPOCH FROM e.end_at_utc - e.start_at_utc) / 3600.0, 0)::numeric AS duration_hours,
                COUNT(u.id)::integer AS participating_volunteers_count
            FROM events e
            LEFT JOIN event_participations p
                ON p.event_id = e.id
               AND p.participation_status = @partecipaStatus
            LEFT JOIN users u
                ON u.id = p.user_id
               AND u.is_deleted = FALSE
               AND u.user_type = @volunteerUserType
            WHERE e.is_deleted = FALSE
              AND e.status = @concludedStatus
              AND (@fromUtc IS NULL OR e.start_at_utc >= @fromUtc)
              AND (@toUtc IS NULL OR e.start_at_utc <= @toUtc)
            GROUP BY e.id, e.start_at_utc, e.end_at_utc
            ORDER BY e.start_at_utc, e.id;
            """;

        AddCommonParameters(command, filter);

        var items = new List<ReportingEventContribution>();
        await using var reader = await command.ExecuteReaderAsync(ct);
        while (await reader.ReadAsync(ct))
        {
            var durationHours = reader.GetFieldValue<decimal>(0);
            var participatingVolunteersCount = reader.GetInt32(1);
            items.Add(new ReportingEventContribution(TimeSpan.FromHours((double)durationHours), participatingVolunteersCount));
        }

        return items;
    }

    private async Task<IReadOnlyList<ReportingVolunteerSnapshot>> ReadVolunteerTotalsAsync(ReportingFilter filter, CancellationToken ct)
    {
        var connection = _db.Database.GetDbConnection();
        await using var command = connection.CreateCommand();
        command.CommandText = """
            SELECT
                u.id,
                u.first_name,
                u.last_name,
                COALESCE(SUM(EXTRACT(EPOCH FROM e.end_at_utc - e.start_at_utc)) / 3600.0, 0)::numeric AS total_hours,
                COUNT(e.id)::integer AS participated_events_count
            FROM users u
            LEFT JOIN event_participations p
                ON p.user_id = u.id
               AND p.participation_status = @partecipaStatus
            LEFT JOIN events e
                ON e.id = p.event_id
               AND e.is_deleted = FALSE
               AND e.status = @concludedStatus
               AND (@fromUtc IS NULL OR e.start_at_utc >= @fromUtc)
               AND (@toUtc IS NULL OR e.start_at_utc <= @toUtc)
            WHERE u.is_deleted = FALSE
              AND u.user_type = @volunteerUserType
            GROUP BY u.id, u.first_name, u.last_name;
            """;

        AddCommonParameters(command, filter);

        var items = new List<ReportingVolunteerSnapshot>();
        await using var reader = await command.ExecuteReaderAsync(ct);
        while (await reader.ReadAsync(ct))
        {
            items.Add(new ReportingVolunteerSnapshot(
                reader.GetGuid(0),
                reader.GetString(1),
                reader.GetString(2),
                reader.GetFieldValue<decimal>(3),
                reader.GetInt32(4)));
        }

        return items;
    }

    private static void AddCommonParameters(DbCommand command, ReportingFilter filter)
    {
        command.Parameters.Clear();
        command.Parameters.Add(CreateParameter("partecipaStatus", DbType.Int32, (int)EventParticipationStatus.Partecipa));
        command.Parameters.Add(CreateParameter("concludedStatus", DbType.Int32, (int)EventStatus.Concluded));
        command.Parameters.Add(CreateParameter("volunteerUserType", DbType.Int32, (int)UserType.Volontario));
        command.Parameters.Add(CreateParameter("fromUtc", DbType.DateTime, filter.FromUtc));
        command.Parameters.Add(CreateParameter("toUtc", DbType.DateTime, filter.ToUtc));
    }

    private static DbParameter CreateParameter(string name, DbType dbType, object? value)
    {
        return new NpgsqlParameter
        {
            ParameterName = name,
            DbType = dbType,
            Value = value ?? DBNull.Value
        };
    }
}