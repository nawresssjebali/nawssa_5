import { ComponentFixture, TestBed } from '@angular/core/testing';

import { DashboardMedecinCardiologueComponent } from './dashboard-medecin-cardiologue.component';

describe('DashboardMedecinCardiologueComponent', () => {
  let component: DashboardMedecinCardiologueComponent;
  let fixture: ComponentFixture<DashboardMedecinCardiologueComponent>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [DashboardMedecinCardiologueComponent]
    })
    .compileComponents();

    fixture = TestBed.createComponent(DashboardMedecinCardiologueComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
