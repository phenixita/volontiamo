namespace volontiamo.domain;

public record PagedResult<T>(IReadOnlyList<T> Items, int TotalCount);

public interface IUserRepository
{
    Task<User?> GetByIdAsync(Guid id, CancellationToken ct = default);
    Task<PagedResult<User>> ListAsync(int page, int pageSize, CancellationToken ct = default);
    Task<bool> ExistsByEmailAsync(string normalizedEmail, Guid? excludeId = null, CancellationToken ct = default);
    Task AddAsync(User user, CancellationToken ct = default);
    Task SaveChangesAsync(CancellationToken ct = default);
}
