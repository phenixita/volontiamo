using volontiamo.domain;

namespace volontiamo.domain.test.L0;

public class UserServiceTests
{
    [Fact]
    public async Task CreateAsync_WhenRequestIsInvalid_ReturnsValidationError()
    {
        var repository = new FakeUserRepository();
        var service = new UserService(repository);
        var request = ValidCreateRequest() with { FirstName = "" };

        var result = await service.CreateAsync(request);

        Assert.Equal(ResultStatus.ValidationError, result.Status);
        Assert.Contains(result.Errors, e => e.Field == "firstName");
        Assert.Equal(0, repository.AddCallCount);
        Assert.Equal(0, repository.SaveChangesCallCount);
    }

    [Fact]
    public async Task CreateAsync_WhenEmailAlreadyExists_ReturnsConflict()
    {
        var repository = new FakeUserRepository { ExistsByEmailResult = true };
        var service = new UserService(repository);
        var request = ValidCreateRequest(email: "  MARIO.ROSSI@example.com ");

        var result = await service.CreateAsync(request);

        Assert.Equal(ResultStatus.Conflict, result.Status);
        Assert.Equal("mario.rossi@example.com", repository.LastExistsByEmailInput);
        Assert.Equal(0, repository.AddCallCount);
        Assert.Equal(0, repository.SaveChangesCallCount);
    }

    [Fact]
    public async Task CreateAsync_WhenRequestIsValid_PersistsUserAndReturnsMappedResponse()
    {
        var repository = new FakeUserRepository();
        var service = new UserService(repository);
        var request = ValidCreateRequest(email: "  MARIO.ROSSI@example.com ");

        var result = await service.CreateAsync(request);

        Assert.Equal(ResultStatus.Ok, result.Status);
        Assert.NotNull(result.Value);
        Assert.Equal("Mario", result.Value!.FirstName);
        Assert.Equal("mario.rossi@example.com", result.Value.Email);
        Assert.Equal(1, repository.AddCallCount);
        Assert.Equal(1, repository.SaveChangesCallCount);
        Assert.NotNull(repository.LastAddedUser);
    }

    [Fact]
    public async Task GetByIdAsync_WhenUserDoesNotExist_ReturnsNotFound()
    {
        var repository = new FakeUserRepository();
        var service = new UserService(repository);

        var result = await service.GetByIdAsync(Guid.NewGuid());

        Assert.Equal(ResultStatus.NotFound, result.Status);
    }

    [Fact]
    public async Task GetByIdAsync_WhenUserExists_ReturnsMappedResponse()
    {
        var existing = CreateUser(firstName: "Anna", lastName: "Bianchi", email: "anna@example.com");
        var repository = new FakeUserRepository { GetByIdResult = existing };
        var service = new UserService(repository);

        var result = await service.GetByIdAsync(existing.Id);

        Assert.Equal(ResultStatus.Ok, result.Status);
        Assert.NotNull(result.Value);
        Assert.Equal(existing.Id, result.Value!.Id);
        Assert.Equal("Anna", result.Value.FirstName);
    }

    [Fact]
    public async Task ListAsync_NormalizesPaginationAndMapsItems()
    {
        var user = CreateUser(firstName: "Laura", lastName: "Neri", email: "laura@example.com");
        var repository = new FakeUserRepository
        {
            ListHandler = (page, pageSize) => new PagedResult<User>([user], 1)
        };
        var service = new UserService(repository);

        var result = await service.ListAsync(page: 0, pageSize: 999);

        Assert.Equal(1, repository.LastListPage);
        Assert.Equal(100, repository.LastListPageSize);
        Assert.Equal(1, result.Page);
        Assert.Equal(100, result.PageSize);
        Assert.Single(result.Items);
        Assert.Equal(user.Id, result.Items[0].Id);
    }

    [Fact]
    public async Task UpdateAsync_WhenRequestIsInvalid_ReturnsValidationError()
    {
        var repository = new FakeUserRepository();
        var service = new UserService(repository);
        var request = ValidUpdateRequest() with { Email = "" };

        var result = await service.UpdateAsync(Guid.NewGuid(), request);

        Assert.Equal(ResultStatus.ValidationError, result.Status);
        Assert.Contains(result.Errors, e => e.Field == "email");
        Assert.False(repository.GetByIdCalled);
    }

    [Fact]
    public async Task UpdateAsync_WhenUserDoesNotExist_ReturnsNotFound()
    {
        var repository = new FakeUserRepository();
        var service = new UserService(repository);

        var result = await service.UpdateAsync(Guid.NewGuid(), ValidUpdateRequest());

        Assert.Equal(ResultStatus.NotFound, result.Status);
    }

    [Fact]
    public async Task UpdateAsync_WhenEmailAlreadyExists_ReturnsConflict()
    {
        var existing = CreateUser(firstName: "Mario", lastName: "Rossi", email: "mario@old.com");
        var repository = new FakeUserRepository
        {
            GetByIdResult = existing,
            ExistsByEmailResult = true
        };
        var service = new UserService(repository);
        var request = ValidUpdateRequest(email: "  DUPLICATE@example.com ");

        var result = await service.UpdateAsync(existing.Id, request);

        Assert.Equal(ResultStatus.Conflict, result.Status);
        Assert.Equal("duplicate@example.com", repository.LastExistsByEmailInput);
        Assert.Equal(existing.Id, repository.LastExistsByEmailExcludeId);
        Assert.Equal(0, repository.SaveChangesCallCount);
    }

    [Fact]
    public async Task UpdateAsync_WhenDataIsValid_UpdatesUserAndSaves()
    {
        var existing = CreateUser(firstName: "Mario", lastName: "Rossi", email: "mario@old.com");
        var repository = new FakeUserRepository { GetByIdResult = existing };
        var service = new UserService(repository);
        var request = ValidUpdateRequest(
            firstName: "Giuseppe",
            lastName: "Verdi",
            email: "  GIUSEPPE@example.com ");

        var result = await service.UpdateAsync(existing.Id, request);

        Assert.Equal(ResultStatus.Ok, result.Status);
        Assert.NotNull(result.Value);
        Assert.Equal("Giuseppe", existing.FirstName);
        Assert.Equal("Verdi", existing.LastName);
        Assert.Equal("giuseppe@example.com", existing.Email);
        Assert.Equal(1, repository.SaveChangesCallCount);
    }

    [Fact]
    public async Task DeleteAsync_WhenUserDoesNotExist_ReturnsNotFound()
    {
        var repository = new FakeUserRepository();
        var service = new UserService(repository);

        var result = await service.DeleteAsync(Guid.NewGuid());

        Assert.Equal(ResultStatus.NotFound, result.Status);
    }

    [Fact]
    public async Task DeleteAsync_WhenUserExists_SoftDeletesAndSaves()
    {
        var existing = CreateUser(firstName: "Mario", lastName: "Rossi", email: "mario@example.com");
        var repository = new FakeUserRepository { GetByIdResult = existing };
        var service = new UserService(repository);

        var result = await service.DeleteAsync(existing.Id);

        Assert.Equal(ResultStatus.Ok, result.Status);
        Assert.True(result.Value);
        Assert.True(existing.IsDeleted);
        Assert.Equal(1, repository.SaveChangesCallCount);
    }

    private static CreateUserRequest ValidCreateRequest(
        string firstName = "Mario",
        string lastName = "Rossi",
        string email = "mario.rossi@example.com")
    {
        return new CreateUserRequest(
            FirstName: firstName,
            LastName: lastName,
            Email: email,
            Phone: "+39 333 1234567",
            DateOfBirth: new DateOnly(1985, 3, 15),
            EnrollmentDate: new DateOnly(2024, 1, 10),
            EndDate: null,
            IsActive: true,
            UserType: UserType.Volontario,
            Occupation: "Ingegnere");
    }

    private static UpdateUserRequest ValidUpdateRequest(
        string firstName = "Mario",
        string lastName = "Rossi",
        string email = "mario.rossi@example.com")
    {
        return new UpdateUserRequest(
            FirstName: firstName,
            LastName: lastName,
            Email: email,
            Phone: "+39 333 1234567",
            DateOfBirth: new DateOnly(1985, 3, 15),
            EnrollmentDate: new DateOnly(2024, 1, 10),
            EndDate: null,
            IsActive: true,
            UserType: UserType.Volontario,
            Occupation: "Ingegnere");
    }

    private static User CreateUser(string firstName, string lastName, string email)
    {
        return User.Create(
            firstName,
            lastName,
            email,
            "+39 333 1234567",
            new DateOnly(1985, 3, 15),
            new DateOnly(2024, 1, 10),
            null,
            true,
            UserType.Volontario,
            "Ingegnere");
    }

    private sealed class FakeUserRepository : IUserRepository
    {
        public User? GetByIdResult { get; set; }
        public PagedResult<User> ListResult { get; set; } = new([], 0);
        public bool ExistsByEmailResult { get; set; }

        public Func<Guid, User?>? GetByIdHandler { get; set; }
        public Func<int, int, PagedResult<User>>? ListHandler { get; set; }
        public Func<string, Guid?, bool>? ExistsByEmailHandler { get; set; }

        public bool GetByIdCalled { get; private set; }
        public int LastListPage { get; private set; }
        public int LastListPageSize { get; private set; }
        public string? LastExistsByEmailInput { get; private set; }
        public Guid? LastExistsByEmailExcludeId { get; private set; }
        public User? LastAddedUser { get; private set; }
        public int AddCallCount { get; private set; }
        public int SaveChangesCallCount { get; private set; }

        public Task<User?> GetByIdAsync(Guid id, CancellationToken ct = default)
        {
            GetByIdCalled = true;
            var user = GetByIdHandler is null ? GetByIdResult : GetByIdHandler(id);
            return Task.FromResult(user);
        }

        public Task<PagedResult<User>> ListAsync(int page, int pageSize, CancellationToken ct = default)
        {
            LastListPage = page;
            LastListPageSize = pageSize;
            var result = ListHandler is null ? ListResult : ListHandler(page, pageSize);
            return Task.FromResult(result);
        }

        public Task<bool> ExistsByEmailAsync(string normalizedEmail, Guid? excludeId = null, CancellationToken ct = default)
        {
            LastExistsByEmailInput = normalizedEmail;
            LastExistsByEmailExcludeId = excludeId;
            var result = ExistsByEmailHandler is null
                ? ExistsByEmailResult
                : ExistsByEmailHandler(normalizedEmail, excludeId);
            return Task.FromResult(result);
        }

        public Task AddAsync(User user, CancellationToken ct = default)
        {
            LastAddedUser = user;
            AddCallCount++;
            return Task.CompletedTask;
        }

        public Task SaveChangesAsync(CancellationToken ct = default)
        {
            SaveChangesCallCount++;
            return Task.CompletedTask;
        }
    }
}